"use strict";

let nailCount = 200;
let populationSize = 100;
let eliteCount = 20;
let genomeSize = 2000;
let imageSize = 100;
let iterationsCount = 20000;
let mutationSpread = 0.01;
let mutationCount = 0.001;
let ringDiameter = 200;
let threadDiameter = 0.05;
let threadOpacity = imageSize * threadDiameter / ringDiameter;

let nailPoints = new Int32Array(nailCount * 2);
let bounds = new Int32Array(imageSize * 2);

let slabSize = 0;

let kernel = null;
let canvas = null;
let populations = [];

let generation = 0;
let lastPopulation = 0;

let needToStop = false;

console.log("Heyo");

onmessage = function(data) {
	data = data.data;
	if(data[0] == "init") {
		init();
		kernel.copyFrom(data[1]);
		kernel.normalize();

		postMessage(["settings", {
			nailCount: nailCount,
			ringDiameter: ringDiameter,
			threadDiameter: threadDiameter
		}]);
	}

	if(data[0] == "step") {
		for(let i=0; i<data[1]; i++) {
			iterate();
		}
		postMessage(["result", getBest(), generation]);
	}

	if(data[0] == "run") {
		needToStop = false;
		run(data[1]);
	}

	if(data[0] == "pause") {
		needToStop = true;
	}
}

function run(step) {
	if(needToStop) {
		return;
	}
	step = step || (Math.random() * 20 + 1) | 0; 
	for(let i=0; i<step; i++) {
		iterate();
	}
	postMessage(["result", getBest(), generation]);
	setTimeout(function() {
		run(step);
	}, 0);
}

function init() {
	makeHull();
	makePoints();
	makeSlabSize();

	kernel = new Slab();
	canvas = new Slab();

	populations[0] = new Population();
	populations[1] = new Population();
}

function iterate() {
	let current = generation % 2;
	let next = (generation + 1) % 2;

	populations[current].calculateFitness(kernel, canvas);

	generateNewPopulation(populations[current], populations[next]);

	let fitness = populations[current].population[0].fitness;

	lastPopulation = current;
	generation++;

	return fitness;
}

function getBest() {
	return populations[lastPopulation].population[0].dna;
}

class Slab {
	constructor() {
		this.data = new Float64Array(imageSize * imageSize);
		this.fill(0.0);
	}

	fill(color) {
		this.data.fill(color);
	}

	normalize() {
		let mean = 0.0;
		let dev = 0.0;
		let data = this.data;
		let size = imageSize;
		let b = bounds;

		for (let i = 0; i < size; i++) {
			for (let j = b[i * 2]; j <= b[i * 2 + 1]; j++) {
				mean += data[j + i * size];
			}
		}
		mean /= slabSize;

		let d;
		for (let i = 0; i < size; i++) {
			for (let j = b[i * 2]; j <= b[i * 2 + 1]; j++) {
				d = data[j + i * size] - mean;
				dev += d * d;
			}
		}
		dev = Math.sqrt(dev);

		for (let i = 0; i < size; i++) {
			for (let j = b[i * 2]; j <= b[i * 2 + 1]; j++) {
				data[j + i * size] = (data[j + i * size] - mean) / dev;
			}
		}
	}

	covariate(kernel) {
		let result = 0.0;
		let data = this.data;
		let size = imageSize;
		let b = bounds;
		for (let i = 0; i < size; i++) {
			for (let j = b[i * 2]; j <= b[i * 2 + 1]; j++) {
				result += data[j + i * size] * kernel[j + i * size];
			}
		}
		return result;
	}

	diff(kernel) {
		let result = 0.0;
		let data = this.data;
		let size = imageSize;
		let b = bounds;
		let t = 0;
		for (let i = 0; i < size; i++) {
			for (let j = b[i * 2]; j <= b[i * 2 + 1]; j++) {
				t = data[j + i * size] - kernel[j + i * size];
				result += t * t;
			}
		}
		return 1 / Math.sqrt(result);
	}

	addPixel(x, y, opacity) {
		this.data[y * imageSize + x] += opacity;
	}

	clamp() {
		let size = imageSize;
		let data = this.data;
		let b = bounds;
		for (let i = 0; i < size; i++) {
			for (let j = b[i * 2]; j <= b[i * 2 + 1]; j++) {
				data[j + i * size] = Math.min(data[j + i * size], 1.0);
			}
		}
	}

	copyFrom(data) {
		for(let i=0; i<this.data.length && i < data.length; i++) {
			this.data[i] = data[i];
		}
	}
}

class Genome {
	constructor() {
		this.dna = new Int32Array(genomeSize);
		this.elite = false;
		this.fitness = 0.0;
		this.weight = 0.0;

		for(let i=0; i<genomeSize; i++) {
			this.dna[i] = Math.random() * nailCount | 0;
		}
	}

	mutate() {
		let spread = mutationSpread;
		let count = mutationCount;
		let nails = nailCount;
		let genSize = genomeSize;
		for (let i = 0; i < genSize; i++) {
			let x = Math.random();
			if (x < count) {
				x = normalRandom();
				let offset = (x * spread * nails + 0.5) | 0;
				while (offset < 0) offset += nails; // to eliminate negative offsets and %
				this.dna[i] = (this.dna[i] + offset) % nails;
			}
		}
	}
}

class Population {
	constructor() {
		this.population = [];
		for(let i=0; i<populationSize; i++) {
			this.population[i] = new Genome();
		}
		this.weighSum = 0;
	}

	calculateFitness() {
		for(let i=0; i<populationSize; i++) {
			if(!this.population[i].elite) {
				drawGenome(this.population[i], canvas);
				canvas.normalize();
				let fitness = canvas.covariate(kernel.data);
				this.population[i].fitness = fitness;
			}
		}
		this.population.sort((a, b) => {
			return b.fitness - a.fitness;
		});
	}

	getParent() {
		let random = Math.pow(Math.random(), 2) * populationSize / 2;
		let i = random | 0;
		return this.population[i];
	}
}

function drawGenome(genome, canvas) {
	canvas.fill(0.0);
	let paint = threadOpacity;
	let x0, x1, y0, y1, dx, dy, sx, sy, err;
	let genSize = genomeSize;
	let nails = nailPoints;
	let dna = genome.dna;
	let data = canvas.data;
	let size = imageSize;
	for (let i = 0; i < genSize - 1; i++) {
		x0 = nails[dna[i] * 2];
		x1 = nails[dna[i + 1] * 2];
		y0 = nails[dna[i] * 2 + 1];
		y1 = nails[dna[i + 1] * 2 + 1];
		dx = Math.abs(x1 - x0);
		dy = Math.abs(y1 - y0);
		sx = (x0 < x1) ? 1 : -1;
		sy = (y0 < y1) ? 1 : -1;
		err = dx - dy;
		while (true) {		
			data[y0 * size + x0] += paint;

			if ((x0 == x1) && (y0 == y1)) break;
			let e2 = 2 * err;
			if (e2 >-dy) { err -= dy; x0 += sx; }
			if (e2 < dx) { err += dx; y0 += sy; }
		}
	}
	canvas.clamp();
}

function crossover(mother, father, child) {
	let size = genomeSize;

	let donor;
	let i = 0;
	let j = 0;
	let jump = (size * ( Math.random() * (0.5 - 0.2) + 0.2) ) | 0;
	donor = Math.random() < 0.5 ? mother : father;
	while (i < size) {
		child.dna[i] = donor.dna[i];
		i++;
		j++;
		if (j == jump) {
			j = 0;
			jump = (size * ( Math.random() * (0.5 - 0.2) + 0.2) ) | 0;
			donor = donor == father ? mother : father;
		}
	}
	child.elite = false;
}

function generateNewPopulation(base, result) {
	for (let i = 0; i < eliteCount && i < populationSize; i++) {
		for(let j=0; j<genomeSize; j++) {
			result.population[i].dna[j] = base.population[i].dna[j];
		}
		result.population[i].elite = true;
	}
	let size = populationSize;
	for (let i = eliteCount; i < size; i++) {
		// select 2 parents
		let mother = base.getParent();
		let father = base.getParent();

		// crossover
		crossover(mother, father, result.population[i]);

		// mutate
		result.population[i].mutate();
	}
}

function intRandom(start, end) {
	return start + Math.random() * (end - start) | 0;
}

function uniformRandom()
{
	return Math.random();
}

function normalRandom()
{
	let u1 = uniformRandom();
	let u2 = uniformRandom();
	return Math.cos(8 * Math.PI * u2) * Math.sqrt(-2 * Math.log(u1));
}

function isPointInCircle(x, y, r) {
	let dx = r - x - 1;
	let dy = r - y - 1;
	return (dx * 2 + 1) * (dx * 2 + 1) + (dy * 2 + 1) * (dy * 2 + 1) <= (r * 2 + 1) * (r * 2 + 1);
}

function makeHull() {
	for (let i = 0; i < imageSize; i++) {
		let y = i * 2;
		let wasInside = false;
		for (let j = 0; j < imageSize; j++) {
			let isInside = isPointInCircle(j, i, imageSize / 2);
			if (isInside && !wasInside) {
				bounds[y] = j;// == 0 ? 0 : j - 1;
				wasInside = true;
			}
			if (wasInside && !isInside) {
				bounds[y + 1]= j;
				wasInside = false;
			}
		}
		if (bounds[y + 1] == 0 && wasInside) {
			bounds[y + 1] = imageSize - 1;
		}
	}
}

function makePoints() {
	for (let i = 0; i < nailCount; i++) {
		let a = 3.14159265359 * 2 * i / nailCount;
		let s = Math.sin(a);
		let c = Math.cos(a);
		let r = imageSize / 2 - 1;
		nailPoints[i * 2] = (imageSize / 2 + c * r) | 0;
		nailPoints[i * 2 + 1] = (imageSize / 2 + s * r) | 0;
	}
}

function makeSlabSize() {
	let l = 0;
	for (let i = 0; i < imageSize; i++) {
		l += bounds[i * 2 + 1] - bounds[i * 2];
	}
	slabSize = l;
}