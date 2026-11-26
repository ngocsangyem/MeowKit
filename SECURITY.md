# Security policy

## Reporting a vulnerability

Report a vulnerability privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Please do not open a public issue for it.

Include what you can of:

- the affected part (the `mewkit` binary, an installer, a hook, a skill script, the release pipeline)
- the version (`mewkit --version`, and the kit version `mewkit versions` prints in the affected project)
- the steps to reproduce it, with a harmless payload
- what an attacker needs beforehand (a hostile repository, a hostile web page or ticket the agent reads, network position, repository write access)

You will get a reply once the report has been read and reproduced.

## What counts

MeowKit installs hooks, skills and a CLI that run on a developer's machine, often on content the developer did not write. Reports in these areas are in scope:

- running code, or reading or sending credentials, through content an agent processes (a repository, a web page, a ticket, a pull request)
- a `mewkit` command writing, reading or deleting outside the project it was run in
- a guard hook that can be bypassed in a way its documentation says it stops
- anything that lets a release, an installer pin or a kit archive be changed without review

## Verifying a download

`install.sh` and `install.ps1` carry the SHA-256 and size of the archive they install and check both before unpacking. Binary archives published by the release workflow also carry a build-provenance attestation:

```bash
gh attestation verify mewkit-<target>.tar.gz --repo ngocsangyem/MeowKit
```
