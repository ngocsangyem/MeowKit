const color = [
  "primary",
  "neutral"
] as const

const variant = [
  "solid",
  "outline",
  "soft",
  "subtle"
] as const

export default {
  "slots": {
    "root": "relative overflow-hidden w-full rounded-lg p-4 flex gap-2.5",
    "wrapper": "min-w-0 flex-1 flex flex-col",
    "title": "text-sm font-medium",
    "description": "text-sm opacity-90",
    "icon": "shrink-0 size-5",
    "avatar": "shrink-0",
    "avatarSize": "2xl",
    "actions": "flex flex-wrap gap-1.5 shrink-0",
    "close": "p-0"
  },
  "variants": {
    "color": {
      "primary": "",
      "neutral": ""
    },
    "variant": {
      "solid": "",
      "outline": "",
      "soft": "",
      "subtle": ""
    },
    "orientation": {
      "horizontal": {
        "root": "items-center",
        "actions": "items-center"
      },
      "vertical": {
        "root": "items-start",
        "actions": "items-start mt-2.5"
      }
    },
    "title": {
      "true": {
        "description": "mt-1"
      }
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "root": "bg-primary text-inverted"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "root": "bg-neutral text-inverted"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "root": "text-primary ring ring-inset ring-primary/25"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "root": "text-neutral ring ring-inset ring-neutral/25"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "root": "bg-primary/10 text-primary"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "root": "bg-neutral/10 text-neutral"
      }
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "root": "bg-primary/10 text-primary ring ring-inset ring-primary/25"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "root": "bg-neutral/10 text-neutral ring ring-inset ring-neutral/25"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": {
        "root": "text-inverted bg-inverted"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": {
        "root": "text-highlighted bg-default ring ring-inset ring-default"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": {
        "root": "text-highlighted bg-elevated/50"
      }
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": {
        "root": "text-highlighted bg-elevated/50 ring ring-inset ring-accented"
      }
    }
  ],
  "defaultVariants": {
    "color": "primary" as typeof color[number],
    "variant": "solid" as typeof variant[number]
  }
}