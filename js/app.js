
var app = new Vue({
  el: '#app',
  data: {
    state: 'begin', // begin, select, run
    paused: false,
    worker: null
  },
  methods: {
  	selectImage: function() {
  		this.$refs["fileInput"].click();
  	},
  	setupImage: function() {
  		this.state = 'select';

  		var input = this.$refs["fileInput"];

  		if (input.files && input.files[0]) {
			var reader = new FileReader();

			reader.onload = function(e) {
				cropper = new ICropper(
					'image-container',    //Container id
					{
						ratio: 1,    //Set aspect ratio of the cropping area
						image: e.target.result
					}
				);
			}
			reader.readAsDataURL(input.files[0]);
		}
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
				document.title = data[2] + " generation";
			} 

			if(data[0] == "settings") {
				drawSettings = data[1];
				drawSettings.points = [];
				let r = 300 / 2;
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
  	getKernel: function() {
		var WIDTH = 100;
		var HEIGHT = 100;

		var kernel = document.createElement("canvas");
		kernel.width = WIDTH;
		kernel.height = HEIGHT;

		var kernelCtx = kernel.getContext("2d");

		var img = document.querySelector("#image-container img");

		var bounds = cropper.getInfo();
		var scale = img.naturalWidth / bounds.cw;

		kernelCtx.drawImage(img, bounds.l * scale, bounds.t * scale, bounds.w * scale, bounds.h * scale, 0, 0, WIDTH, HEIGHT);

		var data = kernelCtx.getImageData(0, 0, WIDTH, HEIGHT).data;

		var kernel = new Float64Array(WIDTH * HEIGHT);
		for(var i=0; i<WIDTH * HEIGHT; i++) {
			kernel[i] = -(data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
		}

		return kernel;
	},
	draw: function(genome, settings) {
		let ctx = this.$refs["canvas"].getContext("2d");
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, 300, 300);

		let g = genome;
		let points = settings.points;

		ctx.strokeStyle = "rgba(0,0,0," + (300 * settings.threadDiameter / settings.ringDiameter) + ")";
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
