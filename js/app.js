
const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 500;

Vue.component('range-option', {
	template: "#range-option",
	data: function() {
		return {
			realValue: this.value * this.multiplier
		}
	},
	props: {
		min: Number,
		max: Number,
		value: Number,
		multiplier: {
			type: Number,
			default: 1
		}
	},
	computed: {
		displayValue: function() {
			return this.realValue / this.multiplier;
		}
	},
	methods: {
		update: function(val) {
			this.realValue = val; 
			this.$emit('input', this.realValue / this.multiplier);
		}
	}
});

var app = new Vue({
  el: '#app',
  data: {
    state: 'begin', // begin, select, run
    image: null,
    cropper: null,
    paused: false,
    worker: null,
    iteration: 0,
    fitness: 0,
    avgTime: 0,
    dna: 0,
    drawSettings: {
    	nailCount: 200,
    	genomeSize: 2500,
    	imageSize: 150,
    	ringDiameter: 200,
    	threadDiameter: 0.05
    },
    showParameters: false
  },
  computed: {
  	prettyFitness: function() {
  		return (this.fitness * this.fitness * 100).toFixed(2);
  	},
  	to1k: function() {
  		if(this.iteration == 0) {
  			return "несколько минут";
  		}
  		return this.formatNumber((1000 - this.iteration) * this.avgTime / (1000 * 60), "минут", "минуту", "минуты");
  	},
  	to10k: function() {
  		if(this.iteration == 0) {
  			return "неизвестно сколько";
  		}
  		return this.formatNumber((10000 - this.iteration) * this.avgTime / (1000 * 60), "минут", "минуту", "минуты");
  	},
  	currentScheme: function() {
  		return this.dna.join(", ");
  	},
  	threadLength: function() {
  		let l = 0;
  		let dx, dy;
  		let points = this.drawSettings.points;
  		for(let i=0; i<this.dna.length - 1; i++) {
  			dx = points[this.dna[i]].x - points[this.dna[i + 1]].x;
  			dy = points[this.dna[i]].y - points[this.dna[i + 1]].y;
  			l += Math.sqrt(dx * dx + dy * dy);
  		}
  		l = l * this.drawSettings.ringDiameter / (1000 * CANVAS_WIDTH);
  		return this.formatNumber(l, "метров", "метр", "метра");
  	}
  },
  methods: {
  	selectImage: function() {
  		this.$refs["fileInput"].click();
  	},
  	usePrepared: function() {
  		var number = Math.random() * 3 | 0;
  		var image = new Image();
  		image.onload = () => {
  			this.image = image;
  			this.run();
  		};
  		image.src = "sample/" + number + ".jpg";
  	},
  	formatNumber: function(val, s0, s1, s2) {
  		val = (val + 0.5) | 0;
  		if(val < 1) {
  			return "чуть-чуть";
  		}
  		let s = s0;
  		let k = val % 100;
  		if(k >= 10 && k < 20) {
  			return val + " " + s;
  		}
  		switch(val % 10) {
  			case 1: s = s1; break;
  			case 2:
  			case 3:
  			case 4: s = s2; break;
  		}
  		return val + " " + s;
  	},
  	toggleParameters: function() {
  		this.showParameters = !this.showParameters;
  	},
  	reset: function() {
  		this.iteration = 0;
  		this.fitness = 0;
  		this.state = 'begin';
  	},
  	setupImage: function() {
  		this.state = 'select';

  		this.$nextTick(() => {

	  		var input = this.$refs["fileInput"];
	  		var self = this;

	  		var container = this.$refs["cropper"];
	  		while(container.childElementCount) {
	  			container.removeChild(container.firstChild);
	  		}

	  		if (input.files && input.files[0]) {
				var reader = new FileReader();

				reader.onload = function(e) {
					self.cropper = new ICropper(
						'image-container', //Container id
						{
							ratio: 1, //Set aspect ratio of the cropping area
							image: e.target.result
						}
					);
					self.image = document.querySelector("#image-container img");
				}
				reader.readAsDataURL(input.files[0]);
			}
		});
  	},
  	run: function() {
  		this.state = 'run';
  		this.paused = false;

  		var kernel = this.getKernel();

  		if(!this.worker) {
  			this.setupWorker();
		}

		this.drawSettings.points = [];
		let r = CANVAS_WIDTH / 2;
		for(let i=0; i<this.drawSettings.nailCount; i++) {
			this.drawSettings.points.push({
				x: r + r * Math.cos(Math.PI * 2 * i / this.drawSettings.nailCount),
				y: r + r * Math.sin(Math.PI * 2 * i / this.drawSettings.nailCount)
			});
		}

		this.worker.postMessage({
			message: "init",
			kernel: kernel,
			settings: this.drawSettings
		});

		this.worker.postMessage({
			message: "run"
		});
  	},
  	setupWorker: function() {
  		this.worker = new Worker("js/knit.js");

		this.worker.onerror = function(data) {
			console.log(data);
		}

		var self = this;

		this.worker.onmessage = function(data) {
			data = data.data;

			if(data.message == "result") {
				self.draw(data.dna);
				self.dna = data.dna;
				self.iteration = data.generation;
				self.fitness = data.fitness;
				self.avgTime = data.time;
				document.title = data.generation + " generation";
			}
		}
  	},
  	pause: function() {
  		if(this.paused) {
  			this.worker.postMessage({
  				message: "run"
  			});
  			this.paused = false;
  		} else {
  			this.worker.postMessage({
  				message: "pause"
  			});
  			this.paused = true;
  		}
  	},
  	getKernel: function(image) {
		let WIDTH = this.drawSettings.imageSize;
		let HEIGHT = this.drawSettings.imageSize;

		let kernelCanvas = document.createElement("canvas");
		kernelCanvas.width = WIDTH;
		kernelCanvas.height = HEIGHT;

		let kernelCtx = kernelCanvas.getContext("2d");

		let img = this.image;

		let bounds = this.cropper ? this.cropper.getInfo() : { l: 0, t: 0, cw: img.naturalWidth, w: img.naturalWidth, h: img.naturalHeight };
		let scale = img.naturalWidth / bounds.cw;

		kernelCtx.drawImage(img, bounds.l * scale, bounds.t * scale, bounds.w * scale, bounds.h * scale, 0, 0, WIDTH, HEIGHT);

		let data = kernelCtx.getImageData(0, 0, WIDTH, HEIGHT).data;

		let kernel = new Float64Array(WIDTH * HEIGHT);
		for(let i=0; i<WIDTH * HEIGHT; i++) {
			kernel[i] = -Math.sqrt(Math.pow(data[i * 4], 2) + Math.pow(data[i * 4 + 1], 2) + Math.pow(data[i * 4 + 2], 2)) / 3;
			//kernel[i] = -(data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
		}

		return kernel;
	},
	draw: function(genome) {
		this.$refs.canvas.width = CANVAS_WIDTH;
		this.$refs.canvas.height = CANVAS_HEIGHT;

		let settings = this.drawSettings;

		let ctx = this.$refs["canvas"].getContext("2d");
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

		let g = genome;
		let points = settings.points;

		ctx.strokeStyle = "rgba(0,0,0," + (CANVAS_WIDTH * settings.threadDiameter / settings.ringDiameter) + ")";
		ctx.beginPath();
		let p = points[g[0]];
		ctx.moveTo(p.x, p.y);
		for(let i=1; i<g.length; i++) {
			p = points[g[i]];
			ctx.lineTo(p.x, p.y);
		}
		ctx.stroke();
	}
  }
});
