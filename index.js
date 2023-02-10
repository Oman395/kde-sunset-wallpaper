import { createCanvas, loadImage } from "canvas";
import { writeFile, readFileSync } from "fs";
import { request } from "http";
import { exec } from "child_process";
import { homedir } from "os";

const GRADIENT = [
  [36, 39, 50], // Base
  [66, 36, 135], // Custom Blue
  [237, 135, 150], // Red
  [197, 160, 246], // Mauve
  [125, 196, 228], // Sapphire
  [125, 196, 228], // Sapphire
  [197, 160, 246], // Mauve
  [237, 135, 150], // Red
  [66, 36, 135], // Custom Blue
  [36, 39, 50], // Base
];
let opts = JSON.parse(readFileSync(`${homedir()}/bin/wpp/config.json`));

const FORE_ASPECT = opts.foregroundAspect ?? 16 / 9; // Foreground aspect ratio
const TIMES_RISE = [-0.5, 0, 0.5, 1, 2]; // First half of GRADIENT, time offsets from after civil twighlight starts
const TIMES_SET = [2, 1, 0.5, 0, -0.5]; // Second half of GRADIENT, time offsets are before civil twighlight ends
const HEIGHT_FRAME = opts.height ?? 1080; // Height of your monitor
const WIDTH_FRAME = opts.width ?? 1920; // Width of your monitor
// I recommend setting these to the lat/long of your city, so that you don't accidentally doxx yourself.
const LAT = opts.lat ?? 40.712776; // Latitude
const LONG = opts.long ?? -74.005974; // Longitude
const LOOP = opts.loog ?? true; // If false, process will exit after setting the wallpaper once.
const UPDATE_MINS = opts.updateIntervalMins ?? 5; // Number of minutes between wallpaper updates. DON'T SET THIS TOO LOW!!!
const VERBOSITY = opts.verbosity ?? 1; // 0 = no logging, 1 = log on new image, 2 = debugging basically

const URL = `http://api.sunrise-sunset.org/json?lat=${LAT}&lng=${LONG}&formatted=0`;

function writeImage(image, canvas, ctx) {
  ctx.restore();
  ctx.drawImage(
    image,
    WIDTH_FRAME - Math.max(HEIGHT_FRAME * FORE_ASPECT, WIDTH_FRAME),
    0,
    Math.max(HEIGHT_FRAME * FORE_ASPECT, WIDTH_FRAME),
    HEIGHT_FRAME
  );
  let file = `${homedir}/bin/wpp/out${Date.now()}.png`;
  writeFile(file, canvas.toBuffer(), () => {
    if (VERBOSITY > 1) console.log(`Written to ${file}, setting as wallpaper.`);
    exec(`dbus-send --session --dest=org.kde.plasmashell --type=method_call /PlasmaShell org.kde.PlasmaShell.evaluateScript 'string:
var Desktops = desktops();                                                                                                                       
for (i=0;i<Desktops.length;i++) {
        d = Desktops[i];
        d.wallpaperPlugin = "org.kde.image";
        d.currentConfigGroup = Array("Wallpaper",
                                    "org.kde.image",
                                    "General");
        d.writeConfig("Image", "${file}");
}'`);
  });
  if (VERBOSITY > 0)
    console.log("New wpp! Time: " + new Date(Date.now()).toString());
}

function generateGradient(data) {
  let time_rise_d = new Date(Date.parse(data.results.civil_twilight_begin));
  let time_set_d = new Date(Date.parse(data.results.civil_twilight_end));
  let time_rise = time_rise_d.getHours() + time_rise_d.getMinutes() / 60;
  let time_set = time_set_d.getHours() + time_set_d.getMinutes() / 60;
  if (VERBOSITY > 1) console.log(`Rise: ${time_rise}, Set: ${time_set}`);
  // The blue is the only non CPT color, I needed something deeper
  let current = 0;
  const canvas = createCanvas(WIDTH_FRAME, HEIGHT_FRAME);
  const ctx = canvas.getContext("2d");
  let gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT_FRAME * 24);
  while (current < GRADIENT.length) {
    if (VERBOSITY > 1) console.log(current, `rgb(${GRADIENT[current]})`);
    if (current < GRADIENT.length / 2.0) {
      if (VERBOSITY > 1) console.log(current, TIMES_RISE[current] + time_rise);
      gradient.addColorStop(
        (TIMES_RISE[current] + time_rise) / 24,
        `rgb(${GRADIENT[current]})`
      );
      current++;
    } else {
      if (VERBOSITY > 1)
        console.log(
          current,
          time_set - TIMES_SET[current - GRADIENT.length / 2]
        );
      gradient.addColorStop(
        (time_set - TIMES_SET[current - GRADIENT.length / 2]) / 24,
        `rgb(${GRADIENT[current]})`
      );
      current++;
    }
  }
  return [canvas, ctx, gradient];
}

function startup(data) {
  if (VERBOSITY > 1) console.log("Data gathered, starting up");
  let pDate = Date.now();
  const [canvas, ctx, gradient] = generateGradient(data);
  function loop() {
    exec(`rm ${homedir()}/bin/wpp/out*.png`);
    let date = new Date(Date.now());
    if (pDate > Date.now()) {
      process.exit(1);
    }
    let pos = (date.getMinutes() / 60 + date.getHours()) * HEIGHT_FRAME;
    ctx.fillStyle = gradient;
    ctx.save();
    ctx.translate(0, -pos);
    ctx.fillRect(0, 0, WIDTH_FRAME, HEIGHT_FRAME * 24);
    ctx.fillRect(0, HEIGHT_FRAME * 24, WIDTH_FRAME, HEIGHT_FRAME * 24);
    loadImage(`${homedir()}/bin/wpp/foreground.png`).then((image) =>
      writeImage(image, canvas, ctx)
    );
  }
  if (LOOP) {
    if (VERBOSITY > 1) console.log("Initializing loop");
    exec(`rm ${homedir}/bin/wpp/out*.png`);
    setInterval(loop, 60000 * UPDATE_MINS);
  }
  loop();
}

function sendReq() {
  request(URL, (res) => {
    if (VERBOSITY > 1) console.log("Response from server");
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => startup(JSON.parse(data)));
  }).end();
}

sendReq();

process.on("uncaughtException", (e) => {
  console.log("Uncaught exception!", e);
});
