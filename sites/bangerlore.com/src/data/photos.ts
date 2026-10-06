import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/gallery/*.{png,jpg,jpeg}', { eager: true });
const g = (name: string) => {
    const key = Object.keys(files).find((k) => k.endsWith('/' + name));
    if (!key) throw new Error(`gallery photo not found: ${name}`);
    return files[key].default;
};

// One ordered pool for the whole site. Home hero = first 3; the manifesto
// grid shows the first 15; the lightbox walks the full list in this order.
// Three editions rotate (v5 warm indoor 1-9, v4 cool flash v4-*, v3 warm
// tungsten v3-*) so no two neighbours look alike.
export const photos = [
    { src: g('1.jpeg'), alt: 'Bangerlore, early evening' },
    { src: g('v4-3460.jpg'), alt: 'Under the flag, Bangerlore v4' },
    { src: g('v3-146.jpg'), alt: 'Under the gazebo' },

    { src: g('v4-3463.jpg'), alt: 'Faff crew' },
    { src: g('v3-12.jpg'), alt: 'Hacking under the gazebo' },
    { src: g('6.jpeg'), alt: 'The living room at Bangerlore' },
    { src: g('v3-39.jpg'), alt: 'Point-and-shoot' },
    { src: g('v4-3501.jpg'), alt: 'A hug by the bar' },
    { src: g('v3-96.jpg'), alt: 'The flag room' },
    { src: g('9.jpeg'), alt: 'Bangerlore after dark' },
    { src: g('v3-53.jpg'), alt: 'Pizza by the flag' },
    { src: g('v4-3444.jpg'), alt: 'Acai theory' },
    { src: g('v3-22.jpg'), alt: 'The hallway crowd' },
    { src: g('2.jpeg'), alt: 'Bangerlore party' },
    { src: g('v3-60.jpg'), alt: 'Friends' },
    { src: g('v4-3498.jpg'), alt: 'Thumbs up under the flag' },
    { src: g('v3-7.jpg'), alt: 'Laptops on the terrace' },
    { src: g('v4-3451.jpg'), alt: 'The terrace at night' },

    { src: g('3.jpeg'), alt: 'Bangerlore party' },
    { src: g('v4-3509.jpg'), alt: 'Two friends' },
    { src: g('v3-74.jpg'), alt: 'The room from above' },
    { src: g('4.jpeg'), alt: 'Bangerlore party' },
    { src: g('v4-3474.jpg'), alt: 'Making a point' },
    { src: g('v3-113.jpg'), alt: 'Making a point' },
    { src: g('7.jpeg'), alt: 'Bangerlore party' },
    { src: g('v4-3480.jpg'), alt: 'Laughing' },
    { src: g('v3-127.jpg'), alt: 'Three friends' },
    { src: g('8.jpeg'), alt: 'Bangerlore party' },
    { src: g('v4-3445.jpg'), alt: 'A conversation' },
    { src: g('v3-138.jpg'), alt: 'Faff banner and the flag' },
    { src: g('v4-3446.jpg'), alt: 'Four friends outside' },
    { src: g('v3-6.jpg'), alt: 'The bar, Faff banner and the flag' },
    { src: g('v4-3493.jpg'), alt: 'Under the flag' },
    { src: g('v4-3471.jpg'), alt: 'The room' },
];

export const hero = photos.slice(0, 3);
export const grid = photos.slice(3, 18);
export const lbIndex = (p: (typeof photos)[number]) => photos.findIndex((q) => q.src === p.src);
