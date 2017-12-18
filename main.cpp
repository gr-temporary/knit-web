// The cheerp/clientlib.h header contains declarations
// for all the browser APIs.
#include <cheerp/client.h> 
#include <cheerp/clientlib.h>
#include <vector>
#include <cmath>

typedef int Chromosome;
typedef std::vector<Chromosome> DNA;
typedef std::pair<int, int> Point;
typedef float DATA;

// for extra speed
#define SIZE 200

int iabs(int a) {
	if(a < 0) return -a;
	return a;
}

int intRandom(int start = 0, int end = 255 * 255) {
	return start + client::Math.random() * (end - start);
}

double uniformRandom()
{
	return client::Math.random();
}

double normalRandom()
{
	double u1 = uniformRandom();
	double u2 = uniformRandom();
	return cos(8.*atan(1.)*u2)*sqrt(-2.*log(u1));
}

bool isPointInCircle(int x, int y, int r) {
	int dx = r - x - 1;
	int dy = r - y - 1;
	return (dx * 2 + 1) * (dx * 2 + 1) + (dy * 2 + 1) * (dy * 2 + 1) <= (r * 2 + 1) * (r * 2 + 1);
}

void makeHull(std::vector<Point> &bounds) {
	bounds.resize(SIZE);

	for (int i = 0; i < SIZE; i++) {
		bool wasInside = false;
		for (int j = 0; j < SIZE; j++) {
			bool isInside = isPointInCircle(j, i, SIZE / 2);
			if (isInside && !wasInside) {
				bounds[i].first = j;// == 0 ? 0 : j - 1;
				wasInside = true;
			}
			if (wasInside && !isInside) {
				bounds[i].second = j;
				wasInside = false;
			}
		}
		if (bounds[i].second == 0 && wasInside) {
			bounds[i].second = SIZE - 1;
		}
	}
}

struct Slab {
	DATA *data;

	Slab() {
		data = new DATA[SIZE * SIZE];
		fill(0.0);
	}

	void free() {
		delete[] data;
	}

	void fill(DATA v = 0.0) {
		for (int i = 0; i < SIZE * SIZE; i++) {
			data[i] = v;
		}
	}

	void normalize() {
		DATA mean = 0.0;
		DATA dev = 0.0;
		for (int i = 0; i < SIZE; i++) {
			for (int j = bounds[i].first; j <= bounds[i].second; j++) {
				mean += data[j + i * SIZE];
			}
		}
		mean /= size;

		DATA d;
		for (int i = 0; i < SIZE; i++) {
			for (int j = bounds[i].first; j <= bounds[i].second; j++) {
				d = data[j + i * SIZE] - mean;
				dev += d * d;
			}
		}
		dev = sqrt(dev);

		for (int i = 0; i < SIZE; i++) {
			for (int j = bounds[i].first; j <= bounds[i].second; j++) {
				data[j + i * SIZE] = (data[j + i * SIZE] - mean) / dev;
			}
		}
	}

	double covariate(const Slab *kernel) {
		DATA result = 0.0;
		for (int i = 0; i < SIZE; i++) {
			for (int j = bounds[i].first; j <= bounds[i].second; j++) {
				result += data[j + i * SIZE] * kernel->data[j + i * SIZE];
			}
		}
		return result;
	}

	void addPixel(int x, int y, DATA opacity) {
		data[y * SIZE + x] += opacity;
	}

	void clamp() {
		for (int i = 0; i < SIZE; i++) {
			for (int j = bounds[i].first; j <= bounds[i].second; j++) {
				data[j + i * SIZE] = std::min(data[j + i * SIZE], (DATA)1.0);
			}
		}
	}

	void pow(DATA power) {
		for (int i = 0; i < SIZE; i++) {
			for (int j = bounds[i].first; j <= bounds[i].second; j++) {
				data[j + i * SIZE] = std::pow(data[j + i * SIZE], power);
			}
		}
	}

	void scan() {
		int j = SIZE / 2;
		for (int i = 0; i < SIZE; i++) {
			//client::console.log("%i:\t%.7lf\n", i, data[j * SIZE + i]);
		}
	}
	
	static int size;
	static std::vector<Point> bounds;
	static void prepare() {
		bounds.resize(SIZE);
		makeHull(bounds);
		int l = 0;
		for (int i = 0; i < SIZE; i++) {
			l += bounds[i].second - bounds[i].first;
		}
		size = l;
	}
};

int Slab::size;
std::vector<Point> Slab::bounds;

struct Genome {
	DNA dna;
	double fitness;
	double weight;

	void init(int size, int nails) {
		dna.resize(size);
		int minOffset = nails * 1 / 5;
		int maxOffset = nails * 4 / 5;
		dna[0] = intRandom() % nails;
		for (int i = 1; i < size; i++) {
			dna[i] = intRandom() % nails;    //(dna[i - 1] + intRandom(minOffset, maxOffset)) % nails;
		}
		fitness = 0.0;
	}

	void mutate(double count, double spread, int nails) {
		for (int i = 0; i < dna.size(); i++) {
			double x = uniformRandom();
			if (x < count) {
				x = normalRandom();
				int offset = floor(x * spread * nails + 0.5);
				while (offset < 0) offset += nails; // to eliminate negative offsets and %
				dna[i] = (dna[i] + offset) % nails;
			}
		}
	}

	void burst(float probability, int nails) {
		for (int i = 0; i < dna.size(); i++) {
			if (uniformRandom() < probability) {
				int offset = floor(uniformRandom() * nails);
				dna[i] = offset;
			}
		}
	}

	client::Int32Array *toArray() {
		return cheerp::MakeTypedArray(&dna[0], dna.size());
	}

	void draw(Slab *canvas, const Point *nails, const float threadOpacity) {
		canvas->fill(0.0);
		DATA paint = threadOpacity;
		int x0, x1, y0, y1, dx, dy, sx, sy, err;
		for (int i = 0; i < dna.size() - 1; i++) {
			x0 = nails[dna[i]].first;
			x1 = nails[dna[i + 1]].first;
			y0 = nails[dna[i]].second;
			y1 = nails[dna[i + 1]].second;
			dx = iabs(x1 - x0);
			dy = iabs(y1 - y0);
			sx = (x0 < x1) ? 1 : -1;
			sy = (y0 < y1) ? 1 : -1;
			err = dx - dy;
			while (true) {
				canvas->addPixel(x0, y0, paint);			

				if ((x0 == x1) && (y0 == y1)) break;
				int e2 = 2 * err;
				if (e2 >-dy) { err -= dy; x0 += sx; }
				if (e2 < dx) { err += dx; y0 += sy; }
			}
		}
		canvas->clamp();
	}

	// ORDER BY fitness DESC
	bool operator <(const Genome &g) const {
		return fitness > g.fitness;
	}
};

typedef std::vector<Genome> Genomes;

struct Population {
	Genomes population;
	double weightSum;

	void init(int populationSize, int genomeSize, int nails) {
		population.resize(populationSize);
		for (int i = 0; i < population.size(); i++) {
			population[i].init(genomeSize, nails);
		}
	}

	double calculateFitness(const Slab *kernel, Slab *canvas, const Point *nails, const float threadOpacity) {
		double minFitness = 10e+7;
		double maxFitness = -10e+7;
		double average = 0.0;
		int size = population.size();

		for (int i = 0; i < size; i++) {
			population[i].draw(canvas, nails, threadOpacity);
			//canvases[this_thread].pow(0.75);
			canvas->normalize();
			double fitness = canvas->covariate(kernel);
			population[i].fitness = fitness;
			if (fitness > maxFitness) maxFitness = fitness;
			if (fitness < minFitness) minFitness = fitness;
			average += fitness;
		}
		std::sort(population.begin(), population.end());

		weightSum = 0.0;
		for (int i = 0; i < population.size(); i++) {
			double weight = (population[i].fitness - minFitness) / (maxFitness - minFitness);
			population[i].weight = weightSum;
			weightSum += weight;
		}
		
		return average / population.size();
	}

	Genome* getParent() {
		double random = uniformRandom() * weightSum / 2; // only first (successful) part, because fuck you
		int i;
		for (i = population.size() - 1; i > 0; i--) {
			if (random > population[i].weight)
				break;
		}
		//printf("Parent: %i (%lf)\n", i, population[i].fitness);
		return &(population[i]);
	}

	Genome* getParentOrdinal() {
		double random = client::Math.pow(uniformRandom(), 2) * population.size() / 2;
		int i = floor(random);
		//printf("%i ", i);
		return &(population[i]);
	}

	void burst(float probability, int nails) {
		for (int i = 0; i < population.size(); i++) {
			population[i].burst(probability, nails);
		}
	}
};

int getCrossoverJumpSize(int size) {
	return floor(size * ( uniformRandom() * (0.5 - 0.2) + 0.2) );
}


Genome crossover(Genome *mother, Genome *father) {
	Genome child;
	int size = mother->dna.size();

	child.dna.resize(size);

	const Genome *donor;
	int i = 0;
	int j = 0;
	int jump = getCrossoverJumpSize(size);
	donor = uniformRandom() < 0.5 ? mother : father;
	while (i < size) {
		child.dna[i] = donor->dna[i];
		i++;
		j++;
		if (j == jump) {
			j = 0;
			jump = getCrossoverJumpSize(size);
			donor = donor == father ? mother : father;
		}
	}
	return child;
}

void generateNewPopulation(Population *base, Population *result, int nails, int elite, double mutationCount, double mutationSpread) {
	for (int i = 0; i < elite && i < result->population.size(); i++) {
		result->population[i] = base->population[i];
	}
	int size = result->population.size();
	for (int i = elite; i < size; i++) {
		// select 2 parents
		Genome* mother = base->getParentOrdinal();
		Genome* father = base->getParentOrdinal();

		// crossover
		result->population[i] = crossover(mother, father);

		// mutate
		result->population[i].mutate(mutationCount, mutationSpread, nails);
	}
}

class [[cheerp::jsexport]] Runner
{
	int nails;
	int populationSize;
	int elite;
	int genomeSize;
	int imageSize;
	int iterations;
	float threadOpacity;
	double mutationSpread;
	double mutationCount;
	double ringDiameter;
	double threadDiameter;

	Point *nailPoints;
	Slab *kernel;
	Slab *canvas;
	Population *population0;
	Population *population1;

	int generation;
	double fitness;
public:
	Runner():nails(200),
			 populationSize(50),
			 elite(5),
			 genomeSize(2500),
			 imageSize(SIZE),
			 iterations(20000),
			 threadOpacity(0.1),
			 mutationSpread(0.01),
			 mutationCount(0.0015),
			 ringDiameter(200),
			 threadDiameter(0.05),
			 generation(0),
			 fitness(0),
			 nailPoints(NULL),
			 kernel(NULL),
			 canvas(NULL),
			 population0(NULL),
			 population1(NULL) {}

	void init() {

		threadOpacity = imageSize * threadDiameter / ringDiameter;

		nailPoints = new Point[nails];
		for (int i = 0; i < nails; i++) {
			double a = 3.14159265359 * 2 * i / nails;
			double s = std::sin(a);
			double c = std::cos(a);
			double r = imageSize / 2 - 1;
			nailPoints[i].first = floor(imageSize / 2 + c * r);
			nailPoints[i].second = floor(imageSize / 2 + s * r);
		}

		Slab::prepare();

		population0 = new Population();
		population1 = new Population();

		population0->init(populationSize, genomeSize, nails);
		population1->init(populationSize, genomeSize, nails);

		kernel = new Slab();
		canvas = new Slab();

		generation = 0;
		fitness = 0;
	}

	int getGeneration() {
		return generation;
	}

	int getFitness() {
		return fitness;
	}

	int getSize() {
		return SIZE;
	}
	
	double next() {
		generation++;

		int current = generation % 2;
		int next = (generation + 1) % 2;

		Population *populations[2];
		populations[0] = population0;
		populations[1] = population1;

		generateNewPopulation(populations[current], populations[next], nails, elite, mutationCount, mutationSpread);

		populations[current]->calculateFitness(kernel, canvas, nailPoints, threadOpacity);
		fitness = populations[current]->population.front().fitness;

		return fitness;
	}

	void setKernelDot(int x, int y, DATA color) {
		kernel->data[x + y * SIZE] = color;
	}

	void finish() {
		kernel->free();
		canvas->free();
		delete[] nailPoints;
		delete population0;
		delete population1;
	}

	client::Int32Array *getBest() {
		Population *populations[2];
		populations[0] = population0;
		populations[1] = population1;
		return populations[generation % 2]->population.front().toArray();
	}
};

// webMain is the entry point for web applications written in Cheerp.
void webMain()
{
    // client is a C++ namespace that contains all browser APIs 
    client::console.log("Hello World Wide Web!");
}