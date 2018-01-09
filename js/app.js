
		var button = document.querySelector("#play-pause");
		var paused = false;

		button.addEventListener("click", playPause);

		function playPause() {
			if(paused) {
				button.innerHTML = "Pause";
				paused = false;
				step();
			} else {
				button.innerHTML = "Play";
				paused = true;
			}
		}

		init();
		for(let i=0; i<imageSize; i++) {
			for(let j=0; j<imageSize; j++) {
	 			kernel.data[i + j * imageSize] = Math.abs(i - imageSize / 2) > imageSize / 4 ? 0 : 1;
			}
		}
		kernel.normalize();

		let drawPoints = [];
		for(let i=0; i<nailCount; i++) {
			let a = 3.14159265359 * 2 * i / nailCount;
			let s = Math.sin(a);
			let c = Math.cos(a);
			let r = 300 / 2 - 1;
			drawPoints[i] = {
				x: (300 / 2 + c * r) | 0,
				y: (300 / 2 + s * r) | 0
			};
		}
		step();
		
		function step() {
			console.time("I");
			for(let i=0; i<2; i++) {
				iterate();
			}
			console.timeEnd("I");
			draw();

			if(!paused) {
				setTimeout(step, 10);
			}
		}

		function draw() {
			let ctx = document.querySelector("canvas").getContext("2d");
			ctx.fillStyle = "#fff";
			ctx.fillRect(0, 0, 300, 300);

			let g = getBest();
			let info = document.querySelector("#info");
			info.innerHTML = generation + " : " + populations[lastPopulation].population[0].fitness + " -- " + populations[lastPopulation].population[populationSize - 1].fitness;
			//console.log(populations[next].population[0].fitness, populations[next].population[populationSize - 1].fitness);

			ctx.strokeStyle = "rgba(0,0,0," + (300 * threadDiameter / ringDiameter) + ")";
			ctx.beginPath();
			let p = drawPoints[g[0]];
			ctx.moveTo(p.x, p.y);
			for(let i=1; i<g.length; i++) {
				p = drawPoints[g[i]];
				ctx.lineTo(p.x, p.y);
			}
			ctx.stroke();
		}