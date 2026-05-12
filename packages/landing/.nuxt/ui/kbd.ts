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

const size = [
  "sm",
  "md",
  "lg"
] as const

export default {
  "base": "inline-flex items-center justify-center px-1 rounded-sm font-medium font-sans uppercase",
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
    "size": {
      "sm": "h-4 min-w-[16px] text-[10px]",
      "md": "h-5 min-w-[20px] text-[11px]",
      "lg": "h-6 min-w-[24px] text-[12px]"
    }
  },
  "compoundVariants": [
    {
      "color": "primary" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-primary"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-neutral"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-primary/50 text-primary"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-neutral/50 text-neutral"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-primary bg-primary/10"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-neutral bg-neutral/10"
    },
    {
      "color": "primary" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-primary ring ring-inset ring-primary/25 bg-primary/10"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "text-neutral ring ring-inset ring-neutral/25 bg-neutral/10"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "solid" as typeof variant[number],
      "class": "text-inverted bg-inverted"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "outline" as typeof variant[number],
      "class": "ring ring-inset ring-accented text-default bg-default"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "soft" as typeof variant[number],
      "class": "text-default bg-elevated"
    },
    {
      "color": "neutral" as typeof color[number],
      "variant": "subtle" as typeof variant[number],
      "class": "ring ring-inset ring-accented text-default bg-elevated"
    }
  ],
  "defaultVariants": {
    "variant": "outline" as typeof variant[number],
    "color": "neutral" as typeof color[number],
    "size": "md" as typeof size[number]
  }
}