import { BadgeType } from "@/components/Menu/MenuItemCard";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviewsCount: number;
  image: string;
  badges: BadgeType[];
  description?: string;
}

export interface MenuCategory {
  id: string;
  name: string;
  icon: string;
  heroImage: string;
  description: string;
  items: MenuItem[];
}

export const bestSellingItems: MenuItem[] = [
  {
    "id": "bg-1",
    "name": "Thic Smash",
    "price": 265,
    "originalPrice": 340,
    "rating": 4.9,
    "reviewsCount": 490,
    "image": "",
    "badges": [
      "non-veg",
      "chef-choice"
    ],
    "description": "Double smash patty seared with wafer-thin onions, melted cheddar & secret house relish."
  },
  {
    "id": "wd-1",
    "name": "Fried Wings",
    "price": 195,
    "originalPrice": 250,
    "rating": 4.8,
    "reviewsCount": 310,
    "image": "",
    "badges": [
      "non-veg",
      "bestseller"
    ],
    "description": "Crispy double-fried golden chicken wings seasoned with fine herbs and sea salt."
  },
  {
    "id": "sq-3",
    "name": "Cheesy Fries",
    "price": 185,
    "originalPrice": 240,
    "rating": 4.9,
    "reviewsCount": 410,
    "image": "",
    "badges": [
      "veg",
      "bestseller"
    ],
    "description": "Crisp fries smothered in molten cheddar cheese fondue."
  },
  {
    "id": "sd-1",
    "name": "French Onion Melt",
    "price": 245,
    "originalPrice": 310,
    "rating": 4.9,
    "reviewsCount": 390,
    "image": "",
    "badges": [
      "veg",
      "chef-choice"
    ],
    "description": "Sweet slow-cooked caramelized onions, melted mozzarella & gruyere on garlic-buttered sourdough."
  },
  {
    "id": "sh-2",
    "name": "Biscoff Shake",
    "price": 205,
    "originalPrice": 260,
    "rating": 4.9,
    "reviewsCount": 510,
    "image": "",
    "badges": [
      "veg",
      "chef-choice"
    ],
    "description": "Lotus Biscoff cookie butter shake crowned with crunchy caramelized biscuit crumble."
  },
  {
    "id": "pa-2",
    "name": "Creamy Alfredo (Non-Veg)",
    "price": 265,
    "originalPrice": 340,
    "rating": 4.9,
    "reviewsCount": 460,
    "image": "",
    "badges": [
      "non-veg",
      "bestseller"
    ],
    "description": "Rich garlic parmesan alfredo with tender grilled chicken slices and cracked black pepper."
  }
];

export const menuData: MenuCategory[] = [
  {
    "id": "side-quest",
    "name": "Side Quest",
    "icon": "🍟",
    "heroImage": "https://images.unsplash.com/photo-1576107232684-1279f3908594?q=80&w=800",
    "description": "Crispy, loaded and seasoned sides designed to elevate your feast.",
    "items": [
      {
        "id": "sq-1",
        "name": "OG Fries",
        "price": 145,
        "originalPrice": 190,
        "rating": 4.8,
        "reviewsCount": 320,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Classic golden skin-on fries tossed in fine sea salt."
      },
      {
        "id": "sq-2",
        "name": "Peri Heat Fries",
        "price": 155,
        "originalPrice": 200,
        "rating": 4.8,
        "reviewsCount": 290,
        "image": "",
        "badges": [
          "veg",
          "spicy"
        ],
        "description": "Golden fries dusted with our signature fiery African peri-peri spice blend."
      },
      {
        "id": "sq-3",
        "name": "Cheesy Fries",
        "price": 185,
        "originalPrice": 240,
        "rating": 4.9,
        "reviewsCount": 410,
        "image": "",
        "badges": [
          "veg",
          "bestseller"
        ],
        "description": "Crisp fries smothered in molten cheddar cheese fondue."
      },
      {
        "id": "sq-4",
        "name": "Chick Loaded Fries",
        "price": 285,
        "originalPrice": 360,
        "rating": 4.9,
        "reviewsCount": 380,
        "image": "",
        "badges": [
          "non-veg",
          "bestseller"
        ],
        "description": "Fries piled high with crispy seasoned chicken bites, smoky mayo & melted cheese."
      },
      {
        "id": "sq-5",
        "name": "Korean Loaded Fries",
        "price": 295,
        "originalPrice": 380,
        "rating": 4.9,
        "reviewsCount": 270,
        "image": "",
        "badges": [
          "non-veg",
          "spicy"
        ],
        "description": "Fries topped with sweet-spicy Korean chicken, gochujang drizzle and sesame seeds."
      },
      {
        "id": "sq-6",
        "name": "Animal Fries",
        "price": 295,
        "originalPrice": 380,
        "rating": 4.8,
        "reviewsCount": 310,
        "image": "",
        "badges": [
          "non-veg",
          "bestseller"
        ],
        "description": "Secret style loaded fries with grilled onions, chopped chicken patty, melted cheese & house sauce."
      }
    ]
  },
  {
    "id": "share-club",
    "name": "Share Club",
    "icon": "🍗",
    "heroImage": "https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?q=80&w=800",
    "description": "Bigger portions meant for the table to share and fight over.",
    "items": [
      {
        "id": "sc-1",
        "name": "Mexican Nachos",
        "price": 155,
        "originalPrice": 200,
        "rating": 4.7,
        "reviewsCount": 240,
        "image": "",
        "badges": [
          "veg",
          "bestseller"
        ],
        "description": "Crispy stone-ground tortilla chips topped with fresh pico de gallo, salsa and cheese."
      },
      {
        "id": "sc-2",
        "name": "Mexican Nachos Chicken",
        "price": 205,
        "originalPrice": 260,
        "rating": 4.9,
        "reviewsCount": 310,
        "image": "",
        "badges": [
          "non-veg",
          "bestseller"
        ],
        "description": "Loaded tortilla chips with Mexican spiced pulled chicken, jalapenos and double cheese drizzle."
      },
      {
        "id": "sc-3",
        "name": "Mushroom Popcorn",
        "price": 165,
        "originalPrice": 210,
        "rating": 4.7,
        "reviewsCount": 180,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Bite-sized button mushrooms coated in seasoned crunch batter and fried golden."
      },
      {
        "id": "sc-4",
        "name": "Corn Ribs",
        "price": 145,
        "originalPrice": 190,
        "rating": 4.8,
        "reviewsCount": 260,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Spiced chargrilled sweet corn ribs brushed with cilantro lime butter and paprika."
      },
      {
        "id": "sc-5",
        "name": "Chicken Popcorn",
        "price": 175,
        "originalPrice": 230,
        "rating": 4.9,
        "reviewsCount": 450,
        "image": "",
        "badges": [
          "non-veg",
          "bestseller"
        ],
        "description": "Tender chicken poppers tossed in garlic herb dusting served with chipotle dip."
      }
    ]
  },
  {
    "id": "burgers",
    "name": "Burgers",
    "icon": "🍔",
    "heroImage": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=800",
    "description": "Smashed patties, molten cheeses and loaded brioche buns.",
    "items": [
      {
        "id": "bg-1",
        "name": "Thic Smash",
        "price": 265,
        "originalPrice": 340,
        "rating": 4.9,
        "reviewsCount": 490,
        "image": "",
        "badges": [
          "non-veg",
          "chef-choice"
        ],
        "description": "Double smash patty seared with wafer-thin onions, melted cheddar & secret house relish."
      },
      {
        "id": "bg-2",
        "name": "Hotshot Chicken",
        "price": 285,
        "originalPrice": 360,
        "rating": 4.8,
        "reviewsCount": 380,
        "image": "",
        "badges": [
          "non-veg",
          "spicy"
        ],
        "description": "Fiery crispy chicken breast drenched in ghost pepper glaze with coleslaw."
      },
      {
        "id": "bg-3",
        "name": "Cheese Crash",
        "price": 295,
        "originalPrice": 380,
        "rating": 4.9,
        "reviewsCount": 520,
        "image": "",
        "badges": [
          "non-veg",
          "bestseller"
        ],
        "description": "Double patties overflowing with a waterfall of molten cheddar fondue & crispy onion rings."
      },
      {
        "id": "bg-4",
        "name": "Herbivore's Hero",
        "price": 245,
        "originalPrice": 310,
        "rating": 4.8,
        "reviewsCount": 290,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Crispy vegetable patty with smoked gouda, pickled cucumbers and garlic aioli."
      },
      {
        "id": "bg-5",
        "name": "The Golden Crunch",
        "price": 275,
        "originalPrice": 350,
        "rating": 4.8,
        "reviewsCount": 330,
        "image": "",
        "badges": [
          "non-veg",
          "bestseller"
        ],
        "description": "Extra-crispy chicken fillet with lettuce, honey mustard and dill pickles on buttered brioche."
      },
      {
        "id": "bg-6",
        "name": "Madam Korean",
        "price": 295,
        "originalPrice": 380,
        "rating": 4.9,
        "reviewsCount": 290,
        "image": "",
        "badges": [
          "non-veg",
          "spicy"
        ],
        "description": "Crispy fried chicken glazed in spicy-sweet Korean Yangnyeom sauce with sesame slaw."
      },
      {
        "id": "bg-7",
        "name": "The Big Veg Crunch",
        "price": 225,
        "originalPrice": 290,
        "rating": 4.7,
        "reviewsCount": 210,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Thick spiced potato-peas crunch patty with mint mayo and crisp iceberg lettuce."
      },
      {
        "id": "bg-8",
        "name": "Crispy Paneer AH?",
        "price": 225,
        "originalPrice": 290,
        "rating": 4.8,
        "reviewsCount": 270,
        "image": "",
        "badges": [
          "veg",
          "bestseller"
        ],
        "description": "Crispy panko-crusted cottage cheese steak with creamy chipotle sauce and pickled onions."
      }
    ]
  },
  {
    "id": "sandos",
    "name": "Sandos",
    "icon": "🥪",
    "heroImage": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?q=80&w=800",
    "description": "Thick gourmet toasted sandwiches packed edge-to-edge with fillings.",
    "items": [
      {
        "id": "sd-1",
        "name": "French Onion Melt",
        "price": 245,
        "originalPrice": 310,
        "rating": 4.9,
        "reviewsCount": 390,
        "image": "",
        "badges": [
          "veg",
          "chef-choice"
        ],
        "description": "Sweet slow-cooked caramelized onions, melted mozzarella & gruyere on garlic-buttered sourdough."
      },
      {
        "id": "sd-2",
        "name": "Magic Mushroom Crisp",
        "price": 245,
        "originalPrice": 310,
        "rating": 4.8,
        "reviewsCount": 260,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Pan-roasted button & shiitake mushrooms with melted provolone and truffle aioli."
      },
      {
        "id": "sd-3",
        "name": "Southside Chick",
        "price": 285,
        "originalPrice": 360,
        "rating": 4.8,
        "reviewsCount": 310,
        "image": "",
        "badges": [
          "non-veg",
          "bestseller"
        ],
        "description": "Tender pulled chicken with hickory barbecue drizzle and house slaw."
      },
      {
        "id": "sd-4",
        "name": "Sweet Heat Chaos",
        "price": 355,
        "originalPrice": 440,
        "rating": 4.9,
        "reviewsCount": 340,
        "image": "",
        "badges": [
          "non-veg",
          "spicy"
        ],
        "description": "Double-fried crispy chicken tossed in hot honey chili glaze with habanero jack cheese."
      },
      {
        "id": "sd-5",
        "name": "Hotter Than Me?",
        "price": 295,
        "originalPrice": 380,
        "rating": 4.8,
        "reviewsCount": 280,
        "image": "",
        "badges": [
          "non-veg",
          "spicy"
        ],
        "description": "Nashville-spiced shredded chicken with fiery Carolina reaper dust and pickled jalapenos."
      },
      {
        "id": "sd-6",
        "name": "OG Crispy Chicken",
        "price": 275,
        "originalPrice": 350,
        "rating": 4.9,
        "reviewsCount": 420,
        "image": "",
        "badges": [
          "non-veg",
          "bestseller"
        ],
        "description": "Buttermilk marinated fried chicken breast with garlic herb mayo and dill pickles."
      },
      {
        "id": "sd-7",
        "name": "Sweet Heat Paneer",
        "price": 235,
        "originalPrice": 300,
        "rating": 4.8,
        "reviewsCount": 240,
        "image": "",
        "badges": [
          "veg",
          "spicy"
        ],
        "description": "Griddled cottage cheese cubes tossed in sweet chili relish with melted mozzarella."
      },
      {
        "id": "sd-8",
        "name": "Double Smash Sando",
        "price": 305,
        "originalPrice": 390,
        "rating": 4.9,
        "reviewsCount": 310,
        "image": "",
        "badges": [
          "non-veg",
          "chef-choice"
        ],
        "description": "Two seared smash patties sandwiched between butter-toasted thick brioche slices."
      },
      {
        "id": "sd-9",
        "name": "Original Crispy Chicken",
        "price": 275,
        "originalPrice": 350,
        "rating": 4.8,
        "reviewsCount": 220,
        "image": "",
        "badges": [
          "non-veg"
        ],
        "description": "Traditional Southern style crispy chicken sando with tangy house tartar."
      }
    ]
  },
  {
    "id": "the-wing-dept",
    "name": "Wing Dept.",
    "icon": "🍗",
    "heroImage": "https://images.unsplash.com/photo-1527477396000-e27163b481c2?q=80&w=800",
    "description": "Crispy chicken wings tossed in our signature house marinades.",
    "items": [
      {
        "id": "wd-1",
        "name": "Fried Wings",
        "price": 195,
        "originalPrice": 250,
        "rating": 4.8,
        "reviewsCount": 310,
        "image": "",
        "badges": [
          "non-veg",
          "bestseller"
        ],
        "description": "Crispy double-fried golden chicken wings seasoned with fine herbs and sea salt."
      },
      {
        "id": "wd-2",
        "name": "Nashville Red Dust",
        "price": 225,
        "originalPrice": 290,
        "rating": 4.9,
        "reviewsCount": 420,
        "image": "",
        "badges": [
          "non-veg",
          "spicy"
        ],
        "description": "Crispy wings coated in hot cayenne Nashville red dust butter."
      },
      {
        "id": "wd-3",
        "name": "Korean Wings",
        "price": 235,
        "originalPrice": 300,
        "rating": 4.9,
        "reviewsCount": 360,
        "image": "",
        "badges": [
          "non-veg",
          "chef-choice"
        ],
        "description": "Wings glazed in sweet sticky Gochujang glaze topped with toasted sesame."
      }
    ]
  },
  {
    "id": "pasta",
    "name": "Pasta",
    "icon": "🍝",
    "heroImage": "https://images.unsplash.com/photo-1621996346565-e3d5d6281292?q=80&w=800",
    "description": "Artisanal pasta tossed in rich velvety sauces prepared fresh.",
    "items": [
      {
        "id": "pa-1",
        "name": "Creamy Alfredo (Veg)",
        "price": 225,
        "originalPrice": 290,
        "rating": 4.9,
        "reviewsCount": 420,
        "image": "",
        "badges": [
          "veg",
          "bestseller"
        ],
        "description": "Silky fettuccine tossed in rich garlic parmesan cream sauce with sauteed mushrooms."
      },
      {
        "id": "pa-2",
        "name": "Creamy Alfredo (Non-Veg)",
        "price": 265,
        "originalPrice": 340,
        "rating": 4.9,
        "reviewsCount": 460,
        "image": "",
        "badges": [
          "non-veg",
          "bestseller"
        ],
        "description": "Rich garlic parmesan alfredo with tender grilled chicken slices and cracked black pepper."
      },
      {
        "id": "pa-3",
        "name": "Green Pesto (Veg)",
        "price": 225,
        "originalPrice": 290,
        "rating": 4.8,
        "reviewsCount": 290,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Penne coated in vibrant freshly pounded basil pine nut pesto and parmesan."
      },
      {
        "id": "pa-4",
        "name": "Green Pesto (Non-Veg)",
        "price": 265,
        "originalPrice": 340,
        "rating": 4.8,
        "reviewsCount": 320,
        "image": "",
        "badges": [
          "non-veg"
        ],
        "description": "Basil pesto penne topped with herb-seared chicken breast and toasted walnut bits."
      },
      {
        "id": "pa-5",
        "name": "Alfredo Wedz Arabitta (Veg)",
        "price": 245,
        "originalPrice": 310,
        "rating": 4.8,
        "reviewsCount": 260,
        "image": "",
        "badges": [
          "veg",
          "spicy"
        ],
        "description": "Spicy pink sauce marrying creamy alfredo with tangy chili arrabbiata and veggies."
      },
      {
        "id": "pa-6",
        "name": "Alfredo Wedz Arabitta (Non-Veg)",
        "price": 265,
        "originalPrice": 340,
        "rating": 4.9,
        "reviewsCount": 310,
        "image": "",
        "badges": [
          "non-veg",
          "spicy"
        ],
        "description": "Spicy pink sauce pasta loaded with spiced shredded chicken and Italian herbs."
      },
      {
        "id": "pa-7",
        "name": "Creamy Prawn Spaghetti",
        "price": 295,
        "originalPrice": 380,
        "rating": 4.9,
        "reviewsCount": 280,
        "image": "",
        "badges": [
          "non-veg",
          "chef-choice"
        ],
        "description": "Delicate spaghetti tossed with sauteed sea prawns in garlic white butter cream."
      },
      {
        "id": "pa-8",
        "name": "Mac & Cheese (Veg)",
        "price": 285,
        "originalPrice": 360,
        "rating": 4.8,
        "reviewsCount": 310,
        "image": "",
        "badges": [
          "veg",
          "bestseller"
        ],
        "description": "Elbow macaroni baked in three-cheese fondue with a golden crumb crust."
      },
      {
        "id": "pa-9",
        "name": "Mac & Cheese (Non-Veg)",
        "price": 295,
        "originalPrice": 380,
        "rating": 4.9,
        "reviewsCount": 340,
        "image": "",
        "badges": [
          "non-veg",
          "bestseller"
        ],
        "description": "Creamy baked mac and cheese folded with grilled chicken pieces."
      },
      {
        "id": "pa-10",
        "name": "Coastal Pasta",
        "price": 325,
        "originalPrice": 410,
        "rating": 4.9,
        "reviewsCount": 390,
        "image": "",
        "badges": [
          "non-veg",
          "chef-choice"
        ],
        "description": "Chef special fusion pasta infused with coastal roasted spices, coconut cream and seafood."
      }
    ]
  },
  {
    "id": "hot-coffee",
    "name": "Hot Coffee",
    "icon": "☕",
    "heroImage": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=800",
    "description": "Handcrafted espresso and freshly brewed hot artisanal coffees.",
    "items": [
      {
        "id": "hc-1",
        "name": "Filter Coffee",
        "price": 30,
        "originalPrice": 40,
        "rating": 4.9,
        "reviewsCount": 580,
        "image": "",
        "badges": [
          "veg",
          "bestseller"
        ],
        "description": "Traditional South Indian chicory blend decoction frothed with rich hot milk."
      },
      {
        "id": "hc-2",
        "name": "Americano",
        "price": 65,
        "originalPrice": 85,
        "rating": 4.7,
        "reviewsCount": 220,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Double shot of rich espresso diluted with hot filtered water."
      },
      {
        "id": "hc-3",
        "name": "Latte",
        "price": 125,
        "originalPrice": 160,
        "rating": 4.8,
        "reviewsCount": 310,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Velvety steamed whole milk poured gently over a single shot of fresh espresso."
      },
      {
        "id": "hc-4",
        "name": "Mocha",
        "price": 149,
        "originalPrice": 190,
        "rating": 4.9,
        "reviewsCount": 280,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Espresso combined with artisanal dark cocoa and silky steamed milk."
      }
    ]
  },
  {
    "id": "iced-coffee",
    "name": "Iced Coffee",
    "icon": "🧊☕",
    "heroImage": "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?q=80&w=800",
    "description": "Chilled espresso brewed over ice for a crisp refreshing kick.",
    "items": [
      {
        "id": "ic-1",
        "name": "Iced Latte",
        "price": 165,
        "originalPrice": 210,
        "rating": 4.8,
        "reviewsCount": 340,
        "image": "",
        "badges": [
          "veg",
          "bestseller"
        ],
        "description": "Chilled espresso poured over cold whole milk and ice blocks."
      },
      {
        "id": "ic-2",
        "name": "Iced Americano",
        "price": 80,
        "originalPrice": 100,
        "rating": 4.7,
        "reviewsCount": 190,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Double shot espresso over cold sparkling iced water."
      },
      {
        "id": "ic-3",
        "name": "Iced Mocha",
        "price": 165,
        "originalPrice": 210,
        "rating": 4.8,
        "reviewsCount": 270,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Rich chocolate ganache, double espresso, cold milk and ice."
      },
      {
        "id": "ic-4",
        "name": "Spanish Iced Latte",
        "price": 170,
        "originalPrice": 220,
        "rating": 4.9,
        "reviewsCount": 420,
        "image": "",
        "badges": [
          "veg",
          "bestseller"
        ],
        "description": "Sweetened condensed milk balanced with bold espresso and cold milk over ice."
      }
    ]
  },
  {
    "id": "coolers",
    "name": "Coolers",
    "icon": "🍹",
    "heroImage": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=800",
    "description": "Sparkling botanical fruit refreshers served over crushed ice.",
    "items": [
      {
        "id": "co-1",
        "name": "Mango Passion",
        "price": 155,
        "originalPrice": 200,
        "rating": 4.8,
        "reviewsCount": 310,
        "image": "",
        "badges": [
          "veg",
          "bestseller"
        ],
        "description": "Tropical Alphonso mango pulp muddled with tangy passionfruit and fizz."
      },
      {
        "id": "co-2",
        "name": "Mixberry Cooler",
        "price": 155,
        "originalPrice": 200,
        "rating": 4.9,
        "reviewsCount": 390,
        "image": "",
        "badges": [
          "veg",
          "bestseller"
        ],
        "description": "Medley of crushed blackberries, raspberries, and blueberries with mint syrup."
      },
      {
        "id": "co-3",
        "name": "Strawberry Lemonade",
        "price": 145,
        "originalPrice": 185,
        "rating": 4.8,
        "reviewsCount": 260,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Freshly squeezed lemon juice, sweet strawberry compote and sparkling soda."
      },
      {
        "id": "co-4",
        "name": "Fizzy Peach",
        "price": 110,
        "originalPrice": 140,
        "rating": 4.7,
        "reviewsCount": 180,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Juicy white peach syrup stirred with sparkling soda and ice."
      },
      {
        "id": "co-5",
        "name": "Fizzy Lemon",
        "price": 110,
        "originalPrice": 140,
        "rating": 4.7,
        "reviewsCount": 160,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Classic salted sweet lemon cooler with sparkling mineral water."
      },
      {
        "id": "co-6",
        "name": "Strawberry Peach",
        "price": 145,
        "originalPrice": 185,
        "rating": 4.8,
        "reviewsCount": 210,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Dual-layer fruit refresher of ripe strawberries and fragrant peaches."
      },
      {
        "id": "co-7",
        "name": "Blue Ocean",
        "price": 135,
        "originalPrice": 175,
        "rating": 4.8,
        "reviewsCount": 290,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Electric blue curacao syrup, lemon essence and effervescent soda."
      }
    ]
  },
  {
    "id": "shakes",
    "name": "Shakes",
    "icon": "🥤",
    "heroImage": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?q=80&w=800",
    "description": "Thick ice cream shakes spun fresh to order.",
    "items": [
      {
        "id": "sh-1",
        "name": "Milo Shake",
        "price": 195,
        "originalPrice": 250,
        "rating": 4.9,
        "reviewsCount": 480,
        "image": "",
        "badges": [
          "veg",
          "bestseller"
        ],
        "description": "Malty chocolate Milo blended thick with vanilla bean gelato and malt dust."
      },
      {
        "id": "sh-2",
        "name": "Biscoff Shake",
        "price": 205,
        "originalPrice": 260,
        "rating": 4.9,
        "reviewsCount": 510,
        "image": "",
        "badges": [
          "veg",
          "chef-choice"
        ],
        "description": "Lotus Biscoff cookie butter shake crowned with crunchy caramelized biscuit crumble."
      },
      {
        "id": "sh-3",
        "name": "Peanut Butter Shake",
        "price": 195,
        "originalPrice": 250,
        "rating": 4.8,
        "reviewsCount": 290,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Creamy roasted peanut butter blended with dairy milk and honey."
      }
    ]
  },
  {
    "id": "speciality",
    "name": "Speciality",
    "icon": "✨",
    "heroImage": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?q=80&w=800",
    "description": "Unique signature dessert drinks and confectionery specials.",
    "items": [
      {
        "id": "sp-1",
        "name": "Mont Blanc",
        "price": 180,
        "originalPrice": 230,
        "rating": 4.9,
        "reviewsCount": 240,
        "image": "",
        "badges": [
          "veg",
          "chef-choice"
        ],
        "description": "Iced dark roast crowned with a mountain of velvety sweet cream foam."
      },
      {
        "id": "sp-2",
        "name": "Blue Cloud",
        "price": 175,
        "originalPrice": 225,
        "rating": 4.8,
        "reviewsCount": 190,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Dreamy blue butterfly pea botanical infusion layered over silky coconut cream."
      },
      {
        "id": "sp-3",
        "name": "Fridge Cigar",
        "price": 165,
        "originalPrice": 210,
        "rating": 4.8,
        "reviewsCount": 310,
        "image": "",
        "badges": [
          "veg",
          "bestseller"
        ],
        "description": "Crisp wafer roll filled with rich dark chocolate fudge ganache."
      }
    ]
  },
  {
    "id": "baristazz-special",
    "name": "Baristazz Special",
    "icon": "🍸",
    "heroImage": "https://images.unsplash.com/photo-1551024709-8f23befc6f87?q=80&w=800",
    "description": "Artisanal barista concoctions pushing flavor boundaries.",
    "items": [
      {
        "id": "bs-1",
        "name": "Soft Cisz Mango",
        "price": 179,
        "originalPrice": 230,
        "rating": 4.9,
        "reviewsCount": 220,
        "image": "",
        "badges": [
          "veg",
          "chef-choice"
        ],
        "description": "Spiced mango puree shaken with elderflower tonic and crushed ice."
      },
      {
        "id": "bs-2",
        "name": "Cool Tonic",
        "price": 149,
        "originalPrice": 190,
        "rating": 4.8,
        "reviewsCount": 180,
        "image": "",
        "badges": [
          "veg"
        ],
        "description": "Crisp botanical tonic water stirred with fresh cucumber ribbons and lime peel."
      }
    ]
  },
  {
    "id": "combos",
    "name": "Special Combos",
    "icon": "🍱",
    "heroImage": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop",
    "description": "Value-packed combo packages with multiple dishes handcrafted for sharing.",
    "items": [
      {
        "id": "combo-1",
        "name": "The Smash & Dip Combo",
        "price": 349,
        "originalPrice": 450,
        "rating": 4.9,
        "reviewsCount": 380,
        "image": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop",
        "badges": [
          "non-veg",
          "bestseller"
        ],
        "description": "Includes: 1 Oklahoma Chicken / Mushroom Smash • 1 Drippy Cheese Fries • 1 Iced Latte or Cooler"
      },
      {
        "id": "combo-2",
        "name": "Rooftop Wings & Sando Feast",
        "price": 599,
        "originalPrice": 780,
        "rating": 4.9,
        "reviewsCount": 420,
        "image": "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?q=80&w=600&auto=format&fit=crop",
        "badges": [
          "non-veg",
          "chef-choice"
        ],
        "description": "Includes: 1 Garlic Parmesan Wings (6 pcs) • 1 Southside Chick / French Onion Sando • 1 Loaded AF Fries • 2 Shakes or Coolers"
      },
      {
        "id": "combo-3",
        "name": "Sando & Cold Brew Delight",
        "price": 299,
        "originalPrice": 410,
        "rating": 4.8,
        "reviewsCount": 290,
        "image": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?q=80&w=600&auto=format&fit=crop",
        "badges": [
          "veg",
          "popular"
        ],
        "description": "Includes: 1 Mushroom & Mayhem or Egg & Melt Sando • 1 Americano or Peach Iced Tea"
      }
    ]
  }
];
