export const possibleTags = ["Video Games", "Religion", "Classwork", "General", "Welcome", "ACM Career", "Career", "Recipes"] as const

export type Tags = typeof possibleTags[number]