
	function qs(selector) {
		return document.querySelector(selector);
	}

	var imageInput = qs("#image-input");

	qs("#image-crop").style.display = "none";
	qs("#select-image-button").addEventListener("click", function() {
		imageInput.click();
	});
	imageInput.addEventListener("change", setupImage);

	var cropper;

	function setupImage(event) {
		qs("#image-crop").style.display = "block";
		if (imageInput.files && imageInput.files[0]) {
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
			reader.readAsDataURL(imageInput.files[0]);
		}
	}

	qs("#start-button").addEventListener("click", start);

	function start() {


		var kernel = getKernel();

		var worker = new Worker("js/knit.js");

		let drawSettings;

		worker.onerror = function(data) {
			console.log(data);
		}

		worker.onmessage = function(data) {
			if(data[0] == "result") {
				draw(data[1], drawSettings);
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

		worker.postMessage(["init", kernel]);

		worker.postMessage(["step", 10]);
	}

	function getKernel() {
		var WIDTH = 100;
		var HEIGHT = 100;

		var kernel = document.createElement("canvas");
		kernel.width = WIDTH;
		kernel.height = HEIGHT;

		var kernelCtx = kernel.getContext("2d");

		var img = qs("#image-container img");

		var bounds = cropper.getInfo();
		var scale = img.naturalWidth / bounds.cw;

		kernelCtx.drawImage(img, bounds.l * scale, bounds.t * scale, bounds.w * scale, bounds.h * scale, 0, 0, WIDTH, HEIGHT);

		var data = kernelCtx.getImageData(0, 0, WIDTH, HEIGHT).data;

		var kernel = new Float64Array(WIDTH * HEIGHT);
		for(var i=0; i<WIDTH * HEIGHT; i++) {
			kernel[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
		}

		return kernel;
	}

		
	function draw(genome, settings) {
		let ctx = qs("canvas").getContext("2d");
		ctx.fillStyle = "#fff";
		ctx.fillRect(0, 0, 300, 300);

		let g = genome;
		let info = qs("#info");
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