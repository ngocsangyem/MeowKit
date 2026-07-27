# Containers and CI

Container images, local runtime composition, and pipeline definitions. The secret boundary in
`SKILL.md` applies here without exception.

## Contents

- [Discover the existing setup](#discover-the-existing-setup)
- [Container images](#container-images)
- [Local composition](#local-composition)
- [Pipelines](#pipelines)
- [Configuration and secrets in CI](#configuration-and-secrets-in-ci)
- [Validation](#validation)

## Discover the existing setup

Read what the repository already builds and runs before changing anything: the container
definitions, ignore files, base images already in use, the pipeline files, and the jobs they
run. Match the existing tool. Introducing a second build system, a second pipeline provider,
or a second base-image family is a decision for the user.

## Container images

Principles, not a template — the right image depends on the language and the runtime target
the repository already chose.

- **Pin what you depend on.** A floating base tag makes the build non-reproducible; the image
  that passed CI is not the image that ships.
- **Separate build from runtime** when the build needs tools the runtime does not. The
  runtime layer should carry the artifact and its dependencies, nothing else.
- **Order layers by change frequency** — dependency manifests before application source — so
  a source change does not rebuild the dependency layer.
- **Exclude what must not ship.** Local environment files, credentials, caches, version
  control metadata, and test fixtures do not belong in an image. Verify the ignore file
  covers them.
- **Do not bake configuration or credentials into the image.** Anything environment-specific
  arrives at runtime. A value in a layer stays in the layer even if a later layer removes it.
- **Run as a non-root user** unless the workload demonstrably needs root; say why if it does.
- **Declare how the runtime knows the process is healthy** in the way the target platform
  expects — as a check the platform already understands, not an invented endpoint.

## Local composition

A local multi-service definition exists to reproduce the system, not to model production.

- Name the services, their dependency order, and what each needs to be considered ready.
- Persist local state in a named volume so a restart does not silently reset data — and so a
  developer can reset it deliberately.
- Reference environment values by name from a committed template. Never commit a filled-in
  environment file, and never read one.
- Keep the local topology honest: if production has one instance of something, do not run
  three locally and call the difference a detail.

## Pipelines

- **State what each job proves.** A job that runs but whose failure is ignored is worse than
  no job — it reads as coverage.
- **Fail closed.** A skipped step, a swallowed exit code, or a continue-on-error on a
  correctness check turns a gate into decoration.
- **Cache the expensive and deterministic parts** — dependency installs, build artifacts —
  keyed on the manifest that determines them. Never cache anything derived from a secret.
- **Keep the deployment job behind an explicit approval** where the platform supports one.
  This skill prepares that job; it does not trigger it.
- **Pin the actions, images, and tool versions** the pipeline depends on, for the same reason
  base images are pinned.
- Run the checks the repository already defines rather than inventing a new command set.

## Configuration and secrets in CI

- A secret is referenced by name from the platform's secret store. It is never written into
  a pipeline file, a container definition, a log line, or a build argument.
- Build arguments are visible in image metadata. They carry configuration, never credentials.
- A pipeline that echoes its environment leaks every secret in it. Do not add such a step,
  and remove one if the change touches it.
- When a required secret is absent, the correct output is a readiness finding naming it —
  not a prompt for the value and not a fallback default.

## Validation

Before handing off:

- The build succeeds from a clean checkout, not only from a warm local state.
- The image contains no environment file, credential, or version-control metadata.
- Every pipeline job that claims to gate the change actually fails when the change is wrong.
- Nothing added prints a secret.
