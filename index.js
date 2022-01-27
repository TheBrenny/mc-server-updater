const nodefetch = require("node-fetch");
const wget = require("wget-improved");
const fs = require("fs/promises");
const path = require("path");
const progress = require('cli-progress');

const baseUrl = "https://papermc.io/api/v2";
const output = "paper.jar";
const cwd = process.cwd();

let prom = Promise.resolve();

async function fetch(endpoint) {
	let data = "";
	return await (await nodefetch(baseUrl + endpoint)).text()
}

async function get(endpoint) {
	let data = "";
	return new Promise((resolve, reject) => {
		let url = baseUrl + endpoint;
		let req = wget.request(url, function(res) {
			if(res.statusCode === 200) {
				res.on('error', (err) => reject(err));
				res.on('data', (chunk) => data += chunk);
				res.on('end', () => resolve(data));
			} else {
				reject({
					error: "http",
					url: baseUrl + endpoint,
					statusCode: res.statusCode
				});
			}
		});
		req.end();
		req.on('error', (err) => {
			reject({
				error: "req",
				url: baseUrl + endpoint,
				statusCode: -1
			});
		});
	});
}

// Part 1 -- Rename the old file to keep a backup
prom = prom.then(async () => {
	await fs.copyFile(path.join(cwd, output), path.join(cwd, output + ".bkp")).catch(e=>console.warn("Warning: " + e.message));
	// await fs.rename(path.join(cwd, output), path.join(cwd, output + ".bkp"));
});

// Part 2 -- Get the info for the latest file
prom = prom.then(async () => {
	let version = JSON.parse(await fetch("/projects/paper")).versions;
	version = version[version.length - 1]; // get latest version
	console.log("Latest version: " + version);

	let build = JSON.parse(await fetch("/projects/paper/versions/" + version)).builds;
	build = build[build.length - 1];
	console.log("Build: " + build);

	let download = JSON.parse(await fetch(`/projects/paper/versions/${version}/builds/${build}`)).downloads.application.name;
	console.log("Download name: " + download);

	return {version, build, download};
});

// Part 3 -- Download the file
prom = prom.then(({version, build, download}) => {
	return new Promise((resolve, reject) => {
		let url = baseUrl + `/projects/paper/versions/${version}/builds/${build}/downloads/${download}`;
		let req = wget.download(url, output);
		req.on('error', (err) => reject(err));

		let size = 0;
		let pBar;

		req.on('start', (s) => {
			size = s;
			pBar = new progress.SingleBar({}, progress.Presets.shades_classic);
			pBar.start(s, 0);
		});
		req.on('progress', (p) => {
			pBar.update(p * size);
		});
		req.on('end', (out) => {
			pBar.stop();
			resolve(out);
		});
	});
});

// Step 4 -- Catchall for any errors
prom = prom.catch((err) => {
	console.error(err);
});
