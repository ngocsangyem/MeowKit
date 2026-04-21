# Angular Component

> Part of meow:angular skill. Read when: working with component.
> Source: analogjs/angular-skills/angular-component (MIT)

## Contents

- [Core Patterns](#core-patterns)
- [Advanced Patterns](#advanced-patterns)


## Core Patterns

**Component Structure:**
```typescript
import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';

@Component({
  selector: 'app-user-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'user-card',
    '[class.active]': 'isActive()',
    '(click)': 'handleClick()',
  },
  template: `
    <img [src]="avatarUrl()" [alt]="name() + ' avatar'" />
    <h2>{{ name() }}</h2>
    @if (showEmail()) {
      <p>{{ email() }}</p>
    }
  `,
  styles: `
    :host { display: block; }
    :host.active { border: 2px solid blue; }
  `,
})
export class UserCard {
  // Required input
  name = input.required<string>();
  
  // Optional input with default
  email = input<string>('');
  showEmail = input(false);
  
  // Input with transform
  isActive = input(false, { transform: booleanAttribute });
  
  // Computed from inputs
  avatarUrl = computed(() => `https://api.example.com/avatar/${this.name()}`);
  
  // Output
  selected = output<string>();
  
  handleClick() {
    this.selected.emit(this.name());
  }
}
```

**Signal Inputs:**
```typescript
// Required - must be provided by parent
name = input.required<string>();

// Optional with default value
count = input(0);

// Optional without default (undefined allowed)
label = input<string>();

// With alias for template binding
size = input('medium', { alias: 'buttonSize' });

// With transform function
disabled = input(false, { transform: booleanAttribute });
value = input(0, { transform: numberAttribute });
```

**Signal Outputs:**
```typescript
import { output, outputFromObservable } from '@angular/core';

// Basic output
clicked = output<void>();
selected = output<Item>();

// With alias
valueChange = output<number>({ alias: 'change' });

// From Observable (for RxJS interop)
scroll$ = new Subject<number>();
scrolled = outputFromObservable(this.scroll$);

// Emit values
this.clicked.emit();
this.selected.emit(item);
```

**Host Bindings (do NOT use @HostBinding/@HostListener):**
```typescript
@Component({
  selector: 'app-button',
  host: {
    // Static attributes
    'role': 'button',
    
    // Dynamic class bindings
    '[class.primary]': 'variant() === "primary"',
    '[class.disabled]': 'disabled()',
    
    // Dynamic style bindings
    '[style.--btn-color]': 'color()',
    
    // Attribute bindings
    '[attr.aria-disabled]': 'disabled()',
    '[attr.tabindex]': 'disabled() ? -1 : 0',
    
    // Event listeners
    '(click)': 'onClick($event)',
    '(keydown.enter)': 'onClick($event)',
    '(keydown.space)': 'onClick($event)',
  },
  template: `<ng-content />`,
})
export class Button {
  variant = input<'primary' | 'secondary'>('primary');
  disabled = input(false, { transform: booleanAttribute });
  color = input('#007bff');
  
  clicked = output<void>();
  
  onClick(event: Event) {
    if (!this.disabled()) {
      this.clicked.emit();
    }
  }
}
```

**Content Projection:**
```typescript
@Component({
  selector: 'app-card',
  template: `
    <header>
      <ng-content select="[card-header]" />
    </header>
    <main>
      <ng-content />
    </main>
    <footer>
      <ng-content select="[card-footer]" />
    </footer>
  `,
})
export class Card {}

// Usage:
// <app-card>
//   <h2 card-header>Title</h2>
//   <p>Main content</p>
//   <button card-footer>Action</button>
// </app-card>
```

**Lifecycle Hooks:**
```typescript
import { OnDestroy, OnInit, afterNextRender, afterRender } from '@angular/core';

export class My implements OnInit, OnDestroy {
  constructor() {
    // For DOM manipulation after render (SSR-safe)
    afterNextRender(() => {
      // Runs once after first render
    });

    afterRender(() => {
      // Runs after every render
    });
  }

  ngOnInit() { /* Component initialized */ }
  ngOnDestroy() { /* Cleanup */ }
}
```

**Accessibility Requirements:**
```typescript
@Component({
  selector: 'app-toggle',
  host: {
    'role': 'switch',
    '[attr.aria-checked]': 'checked()',
    '[attr.aria-label]': 'label()',
    'tabindex': '0',
    '(click)': 'toggle()',
    '(keydown.enter)': 'toggle()',
    '(keydown.space)': 'toggle(); $event.preventDefault()',
  },
  template: `<span class="toggle-track"><span class="toggle-thumb"></span></span>`,
})
export class Toggle {
  label = input.required<string>();
  checked = input(false, { transform: booleanAttribute });
  checkedChange = output<boolean>();
  
  toggle() {
    this.checkedChange.emit(!this.checked());
  }
}
```

**Template Syntax (use native control flow):**
```html
<!-- Conditionals - do NOT use *ngIf -->
@if (isLoading()) {
  <app-spinner />
} @else if (error()) {
  <app-error [message]="error()" />
} @else {
  <app-content [data]="data()" />
}

<!-- Loops - do NOT use *ngFor -->
@for (item of items(); track item.id) {
  <app-item [item]="item" />
} @empty {
  <p>No items found</p>
}

<!-- Switch - do NOT use *ngSwitch -->
@switch (status()) {
  @case ('pending') { <span>Pending</span> }
  @case ('active') { <span>Active</span> }
  @default { <span>Unknown</span> }
}
```

**Class and Style Bindings (do NOT use ngClass/ngStyle):**
```html
<!-- Class bindings -->
<div [class.active]="isActive()">Single class</div>
<div [class]="classString()">Class string</div>

<!-- Style bindings -->
<div [style.color]="textColor()">Styled text</div>
<div [style.width.px]="width()">With unit</div>
```

**Images:**
```typescript
import { NgOptimizedImage } from '@angular/common';

@Component({
  imports: [NgOptimizedImage],
  template: `
    <img ngSrc="/assets/hero.jpg" width="800" height="600" priority />
    <img [ngSrc]="imageUrl()" width="200" height="200" />
  `,
})
export class Hero {
  imageUrl = input.required<string>();
}
```

## Advanced Patterns


Contains advanced patterns including:
- Model Inputs (Two-Way Binding)
- View Queries (viewChild, viewChildren)
- Content Queries (contentChild, contentChildren)
- Dependency Injection in Components
- Component Communication Patterns (Parent-to-Child, Child-to-Parent, Shared Service)
- Dynamic Components with @defer

---
