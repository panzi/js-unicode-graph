import unicodePlot, { makeBox } from "./index.js";

async function main() {
    const TAU = 2 * Math.PI;
    const message = 'Press Control+C to exit.';

    process.stdout.write('\x1B[?25l');

    let timer: NodeJS.Timeout|null = setInterval(() => {
        const now = Date.now();
        const values: [number, number][] = new Array((process.stdout.columns ?? 80) * 3);
        for (let index = 0; index < values.length; ++ index) {
            const x = ((now / 5_000 * TAU) + (TAU * (index / values.length)));
            values[index] = [x, Math.sin(x % TAU)];
        }
        process.stdout.write('\x1B[1;1H\x1B[2J');
        const lines = unicodePlot(values, {
            yRange: [-1.5, 1.5],
            xLabel: x => x.toFixed(3),
            yLabel: y => y.toFixed(3).padStart(6),
            width:  (process.stdout.columns ?? 80) - 9,
            height: (process.stdout.rows    ?? 40) - 5,
        });
        const box = makeBox(lines);
        console.log(box.join('\n'))
        console.log(message.padStart(message.length + ((box[0].length - message.length) >> 1)));
    }, 1000/30);

    const shutdown = () => {
        if (timer !== null) {
            clearInterval(timer);
            timer = null;
        }
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('exit', () => {
        process.stdout.write('\x1B[?25h');
    });
}

main();
