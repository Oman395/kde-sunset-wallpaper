import { createCanvas, loadImage } from "canvas";
import { writeFile, readFileSync } from "fs";
import { request } from "http";
import { exec } from "child_process";
import { homedir } from "os";

const GRADIENT = [
  [36, 39, 50], // Base
  [38, 81, 140], // Custom blue
  [91, 140, 132], // Darkened Teal
  [238, 212, 159], // Yellow
  [238, 212, 159], // Yellow
  [238, 212, 159], // Yellow
  [125, 196, 228], // Sapphire
  [125, 196, 228], // Sapphire
  [238, 212, 159], // Yellow
  [238, 212, 159], // Yellow
  [238, 212, 159], // Yellow
  [116, 179, 169], // Darkened Teal
  [38, 81, 140], // Custom blue
  [36, 39, 50], // Base
];
let opts = JSON.parse(readFileSync(`${homedir()}/bin/wpp/config.json`));

const FORE_ASPECT = opts.foregroundAspect ?? 16 / 9; // Foreground aspect ratio
const TIMES_RISE = [-0.2, 0.1, 0.3, 0.4, 0.5, 0.55, 1.5]; // First half of GRADIENT, time offsets from after civil twighlight starts
const TIMES_SET = [1.5, 0.55, 0.5, 0.4, 0.3, 0.1, -0.2]; // Second half of GRADIENT, time offsets are before civil twighlight ends
const HEIGHT_FRAME = opts.height ?? 1080; // Height of your monitor
const WIDTH_FRAME = opts.width ?? 1920; // Width of your monitor
// I recommend setting these to the lat/long of your city, so that you don't accidentally doxx yourself.
const LAT = opts.lat ?? 40.712776; // Latitude
const LONG = opts.long ?? -74.005974; // Longitude
const LOOP = opts.loog ?? true; // If false, process will exit after setting the wallpaper once.
const UPDATE_MINS = opts.updateIntervalMins ?? 5; // Number of minutes between wallpaper updates. DON'T SET THIS TOO LOW!!!
const VERBOSITY = opts.verbosity ?? 1; // 0 = no logging, 1 = log on new image, 2 = debugging basically
const ENABLE_SUN = true; // Take a wild guess
const SUN_POS = 4; // Which time color to put the sun at
const SUN_W = 128; // Sun width
const SUN_H = 128; // Sun height

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
  let civt_begin_d = new Date(Date.parse(data.results.civil_twilight_begin));
  let civt_end_d = new Date(Date.parse(data.results.civil_twilight_end));
  let civt_begin = civt_begin_d.getHours() + civt_begin_d.getMinutes() / 60;
  let civt_end = civt_end_d.getHours() + civt_end_d.getMinutes() / 60;
  let sunpos;
  if (VERBOSITY > 1)
    console.log(
      `Civil twighlight begin: ${civt_begin}, Civil twighlight end: ${civt_end}`
    );
  // The blue is the only non CPT color, I needed something deeper
  let current = 0;
  const canvas = createCanvas(WIDTH_FRAME, HEIGHT_FRAME);
  const ctx = canvas.getContext("2d");
  let gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT_FRAME * 24);
  while (current < GRADIENT.length) {
    if (VERBOSITY > 1) console.log(current, `rgb(${GRADIENT[current]})`);
    if (current < GRADIENT.length / 2.0) {
      if (VERBOSITY > 1) console.log(current, TIMES_RISE[current] + civt_begin);
      gradient.addColorStop(
        (TIMES_RISE[current] + civt_begin) / 24,
        `rgb(${GRADIENT[current]})`
      );
      if (current === SUN_POS) sunpos = (TIMES_RISE[current] + civt_begin) / 24;
      current++;
    } else {
      if (VERBOSITY > 1)
        console.log(
          current,
          civt_end - TIMES_SET[current - GRADIENT.length / 2]
        );
      gradient.addColorStop(
        (civt_end - TIMES_SET[current - GRADIENT.length / 2]) / 24,
        `rgb(${GRADIENT[current]})`
      );
      if (current === SUN_POS) sunpos = (TIMES_RISE[current] + civt_begin) / 24;
      current++;
    }
  }
  return [canvas, ctx, gradient, sunpos];
}

function startup(data) {
  if (VERBOSITY > 1) console.log("Data gathered, starting up");
  let pDate = Date.now();
  const [canvas, ctx, gradient, sp] = generateGradient(data);
  function loop() {
    exec(`rm ${homedir()}/bin/wpp/out*.png`);
    let date = new Date(Date.now());
    if (pDate > Date.now()) {
      process.exit(1);
    }
    let pos = (date.getMinutes() / 60 + date.getHours()) * HEIGHT_FRAME;
    ctx.fillStyle = gradient;
    loadImage(`${homedir()}/bin/wpp/sun.png`).then((image2) => {
      ctx.save();
      ctx.translate(0, -pos);
      ctx.fillRect(0, 0, WIDTH_FRAME, HEIGHT_FRAME * 24);
      ctx.fillRect(0, HEIGHT_FRAME * 24, WIDTH_FRAME, HEIGHT_FRAME * 24);
      if (ENABLE_SUN)
        ctx.drawImage(
          image2,
          WIDTH_FRAME / 2 - SUN_W / 2,
          sp * 24 * HEIGHT_FRAME - SUN_H / 2,
          SUN_W,
          SUN_H
        );
      loadImage(`${homedir()}/bin/wpp/foreground.png`).then((image) =>
        writeImage(image, canvas, ctx)
      );
    });
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
