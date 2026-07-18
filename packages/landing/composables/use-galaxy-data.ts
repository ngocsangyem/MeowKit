/**
 * Typed access to the generated satellite map (contract version 1).
 * Data is produced by scripts/generate-satellite-map.mjs — never hand-edited.
 */
export type GalaxyNodeKind = 'skill' | 'agent' | 'command' | 'hook'

export interface GalaxySatellite {
  id: string
  label: string
  kind: GalaxyNodeKind
  edge: string
  sharedWith?: string[]
  detail: string
  sourceRef: string
  group?: string
  criticality?: string
}

export interface GalaxyPlanet {
  id: string
  label: string
  kind: GalaxyNodeKind
  sub: string
  detail: string
  sourceRef: string
  group?: string
  criticality?: string
  satellites: GalaxySatellite[]
}

export interface GalaxyCrossLink {
  from: string
  to: string
  label?: string
}

export interface GalaxyBelt {
  count: number
  byKind: { skills: number, agents: number, commands: number, hooks: number }
  sample: string[]
}

export interface SatelliteMap {
  version: number
  meta: { name: string, tagline: string, date: string }
  stats: { skills: number, agents: number, commands: number, hooks: number, edges: number }
  planets: GalaxyPlanet[]
  crossLinks: GalaxyCrossLink[]
  belt: GalaxyBelt
}

export const GALAXY_CONTRACT_VERSION = 1

export function useGalaxyData() {
  const { data, status, error } = useAsyncData(
    'satellite-map',
    () => $fetch<SatelliteMap>('/data/satellite-map.json'),
    { server: false },
  )

  const map = computed<SatelliteMap | null>(() => {
    const value = data.value
    if (!value) return null
    if (value.version !== GALAXY_CONTRACT_VERSION) {
      console.warn(
        `satellite-map.json version ${value.version} does not match expected contract version ${GALAXY_CONTRACT_VERSION}`,
      )
    }
    return value
  })

  return { map, status, error }
}
