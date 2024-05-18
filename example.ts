import unicodePlot, { printBox } from "./index.js";

async function main() {
    const values: [number, number][] = new Array(80 * 4);
    const TAU = 2 * Math.PI;

    process.stdout.write('\x1B[?25l');

    let timer: NodeJS.Timeout|null = setInterval(() => {
        const now = Date.now();
        for (let index = 0; index < values.length; ++ index) {
            const x = ((now / 5_000 * TAU) + (TAU * (index / values.length)));
            values[index] = [x, Math.sin(x % TAU)];
        }
        process.stdout.write('\x1B[1;1H\x1B[2J');
        const lines = unicodePlot(values, {
            yRange: [-1.5, 1.5],
            xLabel: x => x.toFixed(3),
            yLabel: y => y.toFixed(3),
        });
        printBox(lines);
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
