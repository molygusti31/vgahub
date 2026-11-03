const args = process.argv.slice(1);

if (args.includes("--manager")) {
  require("./manager");
} else {
  require("./server_marugo");
}
