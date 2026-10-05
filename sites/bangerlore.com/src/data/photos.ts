import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/gallery/*.{png,jpg,jpeg}', { eager: true });
const g = (name: string) => {
    const key = Object.keys(files).find((k) => k.endsWith('/' + name));
    if (!key) throw new Error(`gallery photo not found: ${name}`);
    return files[key].default;
};

// One ordered pool for the whole site. Home hero = first 3; the manifesto
// grid shows the first 12; the lightbox walks the full list in this order.
// v5 (warm indoor, 1-9) and v4 (cool, flash, v4-*) alternate so no two
// neighbours look alike.
export const photos = [
    { src: g('1.jpeg'), alt: 'Bangerlore, early evening' },
    { src: g('v4-3460.jpg'), alt: 'Under the flag, Bangerlore v4' },
    { src: g('9.jpeg'), alt: 'Bangerlore after dark' },

    { src: g('v4-3463.jpg'), alt: 'Faff crew, Bangerlore v4' },
    { src: g('6.jpeg'), alt: 'The living room at Bangerlore' },
    { src: g('v4-3453.jpg'), alt: 'Photobomb' },
    { src: g('3.jpeg'), alt: 'Bangerlore party' },
    { src: g('v4-3498.jpg'), alt: 'Thumbs up under the flag' },
    { src: g('v4-3451.jpg'), alt: 'The terrace at night' },
    { src: g('v4-3444.jpg'), alt: 'Acai theory' },
    { src: g('2.jpeg'), alt: 'Bangerlore party' },
    { src: g('v4-3509.jpg'), alt: 'Two friends' },

    { src: g('4.jpeg'), alt: 'Bangerlore party' },
    { src: g('v4-3497.jpg'), alt: 'Faff hoodie' },
    { src: g('7.jpeg'), alt: 'Bangerlore party' },
    { src: g('v4-3474.jpg'), alt: 'Making a point' },
    { src: g('8.jpeg'), alt: 'Bangerlore party' },
    { src: g('v4-3480.jpg'), alt: 'Laughing' },
    { src: g('v4-3445.jpg'), alt: 'A conversation' },
    { src: g('v4-3501.jpg'), alt: 'A hug by the bar' },
    { src: g('v4-3446.jpg'), alt: 'Four friends outside' },
    { src: g('v4-3493.jpg'), alt: 'Under the flag' },
    { src: g('v4-3471.jpg'), alt: 'The room' },
];

export const hero = photos.slice(0, 3);
export const grid = photos.slice(3, 15);
export const lbIndex = (p: (typeof photos)[number]) => photos.findIndex((q) => q.src === p.src);
