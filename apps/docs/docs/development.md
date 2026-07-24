---
sidebar_position: 99
---

# Development

## Local Development

After cloning the repo, run `yarn install` in the root directory to install the dependencies.
You can run the project with `yarn start` which creates a local build of the project and watches for changes.

The execuatble are in the `cli/bin` folder. They are:

- `catenv`
- `catenv-dev`
- `catladder`
- `catladder-dev`

TODO: explain differences between normal version and dev version, maybe also add subpages to each command.

## Development Workflow

After adding your changes you can run the the `-dev` version locally in a test Project. If you don't have one yourself you can test it in the [Test Projects](https://git.panter.ch/catladder/test-projects).

To do so you should first create a symlink to the catladder command you need. For exampple if you use `catladder-dev` add the command like this:

```bash
sudo ln -s /Users/hansueli/Development/panter/catladder/cli/bin/catladder-dev /usr/local/bin/catladder-dev
```

Then you can run the command in the wanted project and test your changes.

## Pipeline

## Snapshot tests

There are some [examples](/docs/examples) that double for snapshot-testing.

Please add more examples there. If you need to update the snapshots, run `yarn test:update` in the root directory.
