# Multi-Layer Detection System


## Contents

- [Layer 0: Task Content Analysis (Highest Priority)](#layer-0-task-content-analysis-highest-priority)
- [Layer 1: Explicit Technology Detection](#layer-1-explicit-technology-detection)
- [Layer 2: Intent Detection Patterns](#layer-2-intent-detection-patterns)
- [Layer 3: Project Context Detection](#layer-3-project-context-detection)
- [Layer 4: File Pattern Detection](#layer-4-file-pattern-detection)

## Layer 0: Task Content Analysis (Highest Priority)

**Analyze the actual task, not just the repo.** A backend repo may have frontend tasks (templates, PDFs, emails).

```toon
task_content_triggers[7]{category,example_patterns,activates,score_boost}:
  Frontend,html template/blade/twig/email template/pdf styling/css,frontend,+50 to +60
  Backend,api endpoint/controller/middleware/queue job/webhook,architect (+ framework skill),+50 to +55
  Database,migration/schema/query optimization/slow query/n+1,architect,+55 to +60
  Security,xss/sql injection/csrf/vulnerability/auth bypass,security,+55 to +60
  DevOps,docker/kubernetes/ci-cd/terraform/deployment,devops,+50 to +55
  Testing,unit test/e2e test/coverage/mock/fixture,tester,+45 to +55
  Design,figma/wireframe/design system/accessibility,frontend,+50 to +60
```

**Key insight:** Task content score >=50 -> Override or co-lead with repo-based agent.

**Examples:**

```
# Backend repo, but frontend task
Repo: Laravel API
Task: "Fix email template styling"
-> frontend (PRIMARY) + architect (SECONDARY)

# Frontend repo, but backend task
Repo: Next.js
Task: "Add rate limiting to API route"
-> architect (PRIMARY) + frontend (SECONDARY)
```

---

## Layer 1: Explicit Technology Detection

Check if user **directly mentions** a technology:

```toon
tech_detection[10]{technology,keywords,agent,score}:
  React Native,react-native/expo/RN,mobile,+60
  Flutter,flutter/dart/bloc,mobile-flutter,+60
  Angular,angular/ngrx/rxjs,web-angular,+60
  Vue.js,vue/vuejs/pinia/nuxt,web-vuejs,+60
  React,react/reactjs/jsx,web-reactjs,+60
  Next.js,next/nextjs/ssr/ssg,web-nextjs,+60
  Node.js,nodejs/express/nestjs/fastify,architect,+60
  Python,python/django/fastapi/flask,backend-python,+60
  Go,go/golang/gin/fiber,backend-go,+60
  Laravel,laravel/php/eloquent/artisan,backend-laravel,+60
```

## Layer 2: Intent Detection Patterns

Detect user **intent** from action keywords:

```toon
intent_detection[8]{intent,keywords,primary,secondary}:
  Implementation,implement/create/add/build/develop,Dev agent,frontend/tester
  Bug Fix,fix/bug/error/issue/broken/crash,Dev agent,tester
  Testing,test/testing/coverage/QA/spec,tester,Dev agent
  Design/UI,design/UI/UX/layout/figma/style,frontend,Dev agent
  Database,database/schema/query/migration/SQL,architect,Backend agent
  Security,security/vulnerability/audit/owasp/secure,security,Dev agent
  Performance,performance/slow/optimize/speed/memory,devops,Dev agent
  Deployment,deploy/docker/kubernetes/CI-CD/pipeline,devops,-
```

## Layer 3: Project Context Detection

Read project files to **infer** tech stack:

```toon
project_detection[10]{file,indicates,agent,score}:
  app.json (with expo),React Native,mobile,+40
  pubspec.yaml,Flutter,mobile-flutter,+40
  angular.json,Angular,web-angular,+40
  *.vue files,Vue.js,web-vuejs,+40
  next.config.js,Next.js,web-nextjs,+40
  package.json + react (no next),React,web-reactjs,+40
  package.json + express/nestjs,Node.js,architect,+40
  requirements.txt/pyproject.toml,Python,backend-python,+40
  go.mod/go.sum,Go,backend-go,+40
  artisan/composer.json + laravel,Laravel,backend-laravel,+40
```

## Layer 4: File Pattern Detection

Check **recent files** and naming conventions:

```toon
file_patterns[9]{pattern,agent,score}:
  *.phone.tsx/*.tablet.tsx,mobile,+20
  *.dart/lib/ folder,mobile-flutter,+20
  *.component.ts/*.service.ts,web-angular,+20
  *.vue,web-vuejs,+20
  app/route.ts (Next.js),web-nextjs,+20
  *.controller.ts/*.module.ts,architect,+20
  views.py/models.py,backend-python,+20
  *.go,backend-go,+20
  *Controller.php/*Model.php,backend-laravel,+20
```