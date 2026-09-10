// SPDX-License-Identifier: MPL-2.0
import { runCli } from './commands';

process.exitCode = runCli(process.argv.slice(2), {
  out: text => process.stdout.write(`${text}\n`),
  error: text => process.stderr.write(`astractl: ${text}\n`),
});
