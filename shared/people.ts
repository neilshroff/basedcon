import people from './data/people.json';

export type Person = (typeof people)[number] & { company?: { name: string; url: string } };
export type Site = 'basedcon' | 'bangerlore';

const LINK_ORDER = ['x', 'linkedin', 'web'] as const;

export function peopleFor(site: Site) {
    return (people as Person[])
        .filter((p) => p[site])
        .map((p) => ({
            ...p,
            linkList: LINK_ORDER.filter((k) => p.links[k as keyof typeof p.links]).map((k) => ({
                label: k,
                href: p.links[k as keyof typeof p.links] as string,
            })),
        }));
}
