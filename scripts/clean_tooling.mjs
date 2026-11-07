import { rmSync } from 'node:fs';

// Remove retired emitted tests/modules before compiling the current source set.
rmSync(new URL('../.build/tooling', import.meta.url), { recursive: true, force: true });
