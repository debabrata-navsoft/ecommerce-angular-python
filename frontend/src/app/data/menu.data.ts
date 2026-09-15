export interface MenuItem {
  name: string;
  category?: string;
  hasArrow?: boolean;
  path?: string;
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

export const MENU: MenuSection[] = [
  // {
  //   title: 'Trending',
  //   items: [{ name: 'Best Sellers' }, { name: 'New Releases' }, { name: 'Movers and Shakers' }],
  // },
  // {
  //   title: 'Digital Content And Devices',
  //   items: [
  //     { name: 'Echo & Alexa', hasArrow: true },
  //     { name: 'Fire TV', hasArrow: true },
  //     { name: 'Kindle E-Readers & eBooks', hasArrow: true },
  //     { name: 'Audible Audiobooks', hasArrow: true },
  //     { name: 'Amazon Prime Video', hasArrow: true },
  //     { name: 'Amazon Prime Music', hasArrow: true },
  //   ],
  // },

  {
    title: 'Deals & Offers',
    items: [
      { name: "Today's Deals", path: '/deals/today' },
      { name: 'Best Sellers', path: '/deals/best-sellers' },
      { name: 'New Arrivals', path: '/deals/new-arrivals' },
      { name: 'Trending Products', path: '/deals/trending' },
    ],
  },
  // {
  //   title: 'Digital Services',
  //   items: [
  //     { name: 'Prime Video', path: '/digital/prime-video', hasArrow: true },
  //     { name: 'Music Streaming', path: '/digital/music', hasArrow: true },
  //     { name: 'eBooks & Kindle', path: '/digital/ebooks', hasArrow: true },
  //     { name: 'Audiobooks', path: '/digital/audiobooks', hasArrow: true },
  //   ],
  // },

  {
    title: 'Shop By Category',
    items: [
      { name: 'Electronics', category: 'electronics', hasArrow: true },
      { name: 'Fashion', category: 'fashion', hasArrow: true },
      { name: 'Bags', category: 'bags', hasArrow: true },
      { name: 'Footwear', category: 'footwear', hasArrow: true },
      { name: 'Groceries', category: 'groceries', hasArrow: true },
      { name: 'Beauty', category: 'beauty', hasArrow: true },
      { name: 'Home & Living', category: 'home-living', hasArrow: true },
      // { name: 'Mobiles, Computers', category: 'electronics', hasArrow: true },
      // { name: 'TV, Appliances, Electronics', hasArrow: true },
      // { name: "Men's Fashion, Women's Fashion", hasArrow: true },
      // { name: "Women's Fashion", hasArrow: true },
    ],
  },
];
