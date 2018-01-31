
const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 500;

var app = new Vue({
  el: '#app',
  data: {
    state: 'begin', // begin, select, run
    image: null,
    cropper: null,
    paused: false,
    worker: null,
    iteration: 0,
    fitness: 0
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

  		var kernel = this.getKernel();

		this.worker = new Worker("js/knit.js");

		let drawSettings;

		this.worker.onerror = function(data) {
			console.log(data);
		}

		var self = this;

		this.worker.onmessage = function(data) {
			data = data.data;

			if(data[0] == "result") {
				self.draw(data[1], drawSettings);
				self.iteration = data[2];
				self.fitness = data[3];
				document.title = data[2] + " generation";
			} 

			if(data[0] == "settings") {
				drawSettings = data[1];
				drawSettings.points = [];
				let r = CANVAS_WIDTH / 2;
				for(let i=0; i<drawSettings.nailCount; i++) {
					drawSettings.points.push({
						x: r + r * Math.cos(Math.PI * 2 * i / drawSettings.nailCount),
						y: r + r * Math.sin(Math.PI * 2 * i / drawSettings.nailCount)
					});
				}
			}
		}

		this.worker.postMessage(["init", kernel]);

		this.worker.postMessage(["run"]);
  	},
  	pause: function() {
  		if(this.paused) {
  			this.worker.postMessage(["run"]);
  			this.paused = false;
  		} else {
  			this.worker.postMessage(["pause"]);
  			this.paused = true;
  		}
  	},
  	getKernel: function(image) {
		let WIDTH = 150;
		let HEIGHT = 150;

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
			kernel[i] = -(data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
		}

		return kernel;
	},
	draw: function(genome, settings) {
		this.$refs.canvas.width = CANVAS_WIDTH;
		this.$refs.canvas.height = CANVAS_HEIGHT;

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
