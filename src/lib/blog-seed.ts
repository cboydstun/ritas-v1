/**
 * The three launch blog posts, as data.
 *
 * **No runtime imports.** This module is read by `src/lib/__tests__/blog-seed.test.ts`
 * through Jest's `@/*` alias *and* by a one-off seeding script running under
 * bare `node`, which strips TypeScript types but cannot resolve that alias. A
 * single `import { ... } from "@/lib/blog"` here would break the second caller,
 * so the field list is spelled out locally and `blog-seed.test.ts` is what
 * proves it still satisfies `blogPostCreateSchema` and the `BlogPost` model.
 *
 * Every post is written to score 100 on `auditPost` with all sixteen checks
 * applicable — published, focus keyword set, duplicate check clean. The test
 * asserts that number, so an edit here that costs a point fails CI rather than
 * quietly landing a 94.
 */

export interface BlogSeedPost {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImagePath: string;
  coverImageAlt: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
}

const PLAN_A_PARTY: BlogSeedPost = {
  slug: "margarita-machine-rental-party",
  title: "How to Plan a Margarita Machine Rental Party",
  excerpt:
    "Guest counts, delivery windows, power, mixers and a week-of checklist for hosting a frozen drink party in San Antonio.",
  seoTitle: "",
  seoDescription:
    "What a San Antonio host needs to plan a margarita machine rental party: guest counts, delivery windows, power, mixers and a week-of checklist.",
  focusKeyword: "margarita machine rental",
  coverImagePath: "/margarita-frozen-2.jpg",
  coverImageAlt:
    "A frozen margarita poured from a rental machine into a salted glass",
  tags: ["party planning", "san antonio", "how to"],
  body: `<h2>Start with the guest list, not the machine</h2>
<p>Every margarita machine rental starts with one number: how many people are actually coming. A single tank pours roughly sixty eight-ounce servings before it needs a refill. That comfortably covers a backyard party of twenty to thirty guests across an afternoon.</p>
<p>Push past forty guests and a second tank stops being a luxury. Two tanks let you run a classic lime batch alongside something sweeter. They also cut the wait at the spout roughly in half, which matters more than most hosts expect at an outdoor party in July.</p>
<h2>Book the date before you book anything else</h2>
<p>Weekends between April and October go first in San Antonio. Graduation weekends, Fiesta and the run-up to Labor Day are the tightest dates on the calendar. A margarita machine rental for one of those weekends is usually spoken for weeks ahead.</p>
<p>Our <a href="/order">online booking form</a> shows live availability for every machine size. You can see what is open on your date before you commit to a caterer or a venue. If your date is flexible, a Friday drop-off is easier to secure than a Saturday.</p>
<h2>Plan the delivery window around your setup</h2>
<p>Machines need time to freeze. A tank takes about ninety minutes to reach a proper frozen texture once it is plugged in and filled. A delivery two hours before guests arrive is the shortest window that still works.</p>
<h3>What the machine needs from your venue</h3>
<ul>
<li>A dedicated standard outlet within about fifteen feet, not shared with a smoker or a bounce house blower.</li>
<li>A flat, shaded spot. Direct afternoon sun makes the compressor work harder and slows the freeze.</li>
<li>Roughly three feet of clearance on the vented side, so the unit can breathe.</li>
<li>A table strong enough to hold a full tank, which is heavier than it looks.</li>
</ul>
<h2>Mixers, salt and the things hosts forget</h2>
<p>Mix comes with the machine. Liquor does not, and that catches first-time hosts out every summer. A rental company in Texas supplies equipment rather than alcohol. The <a href="https://www.tabc.texas.gov/" rel="noopener noreferrer">Texas Alcoholic Beverage Commission</a> is the right place to check the rules before a public or ticketed event.</p>
<p>Buy your spirits the day before. One 750ml bottle per tank is the usual starting point, adjusted up or down to taste. Keep cups, ice, limes and salt on a table away from the machine so the line never stalls.</p>
<h2>What it costs, and where the money goes</h2>
<p>Our <a href="/pricing">pricing page</a> lists the current rate for each machine size alongside delivery. The rate is charged per day, so a Friday-to-Sunday weekend costs far less per hour than a single afternoon. Extras such as tables, chairs and a cotton candy cart are priced per day next to it.</p>
<p>Delivery is a flat fee inside Bexar County. If you sit outside the county line, check the <a href="/service-area">service area pages</a> first. A margarita machine rental to a surrounding town may need a different delivery window.</p>
<h2>Two mistakes that cost people a good party</h2>
<p>The first is filling the tank with warm mix an hour before guests arrive. Cold mix freezes faster, so chill the jugs overnight in the refrigerator. It is the single cheapest thing you can do to protect your timeline.</p>
<p>The second is treating the machine as a garnish station. Cups stacked on the lid and a bowl of limes wedged against the vent both slow the compressor down. Give the unit its own small table and put everything else on another one.</p>
<p>Neither mistake ruins an event. Both quietly turn a smooth margarita machine rental into an afternoon of somebody standing over the machine wondering why the pour has gone slushy and thin.</p>
<h2>A short checklist for the week of the party</h2>
<ul>
<li>Confirm the delivery window and the exact drop-off address.</li>
<li>Clear the path from the driveway to the setup spot.</li>
<li>Test the outlet you plan to use.</li>
<li>Buy liquor, ice, cups and limes the day before, never the morning of.</li>
<li>Decide where guests will queue so the line does not cross the food table.</li>
</ul>
<p>Handled in that order, a margarita machine rental is the least stressful part of hosting. The machine runs itself, the pour stays consistent, and nobody is stuck behind a blender for three hours. That is the whole point of booking one.</p>`,
};

const SIZES: BlogSeedPost = {
  slug: "frozen-drink-machine-sizes",
  title: "Frozen Drink Machine Sizes: 15L, 30L or 45L?",
  excerpt:
    "How the 15L, 30L and 45L tanks compare on servings, refills, power draw and footprint, and which one suits your headcount.",
  seoTitle: "",
  seoDescription:
    "Compare 15L, 30L and 45L frozen drink machine sizes on servings, refill pace, power draw and footprint, then match one to your guest count.",
  focusKeyword: "frozen drink machine",
  coverImagePath: "/vevor-30l-slushy-4.webp",
  coverImageAlt: "A double-tank frozen drink machine filled with two flavors",
  tags: ["machines", "buying guide", "capacity"],
  body: `<h2>Tank volume is really a question about refills</h2>
<p>Litres are the headline number, but they are not what you feel at a party. What you feel is how often somebody has to stop, open the lid and pour in another batch. A frozen drink machine that needs refilling every forty minutes changes who gets to enjoy the evening.</p>
<p>Each tank holds its volume in mix, and a standard serving is eight ounces. Round the arithmetic down, because the last inch of any tank never pours cleanly. Plan on the honest number rather than the label.</p>
<h2>The 15L single tank</h2>
<p>One tank, one flavor, roughly sixty servings per fill. This is the right frozen drink machine for a birthday in the backyard, an office send-off or any gathering under about twenty-five guests.</p>
<p>It draws the least power of the three and fits on a card table. If your setup spot is a patio corner with one free outlet, this is the unit that will not argue with you about it.</p>
<h2>The 30L double tank</h2>
<p>Two independent tanks, about a hundred and twenty servings per fill. The second tank is the real upgrade, and not because of volume. It lets you serve two flavors at once, which quietly solves the problem of guests who do not drink alcohol.</p>
<h3>Why two flavors beats one big tank</h3>
<ul>
<li>Run a strawberry batch beside a lime batch and nobody has to compromise.</li>
<li>Keep one tank alcohol free and children have something at the same table.</li>
<li>Two spouts halve the queue at the moment everyone arrives at once.</li>
<li>If one tank empties, the party does not stop while it refills.</li>
</ul>
<h2>The 45L triple tank</h2>
<p>Three tanks, roughly a hundred and eighty servings per fill. This is event equipment. Weddings, church festivals, company picnics and quinceaneras are where it earns its footprint.</p>
<p>Be honest about the space. A triple unit needs a solid table, clearance on the vented side and a circuit it does not share with a warming tray. Our <a href="/pricing">pricing page</a> lists each size next to its rate so you can weigh capacity against cost.</p>
<h2>Matching a size to a headcount</h2>
<ul>
<li>Up to 25 guests, a couple of hours: 15L.</li>
<li>25 to 50 guests, or any party wanting two flavors: 30L.</li>
<li>50 guests and up, or an all-day event: 45L.</li>
<li>Outdoors in August: size up one step, because people drink faster in Texas heat.</li>
</ul>
<p>That last rule is the one people skip. Afternoon highs here sit above ninety degrees for months, and the <a href="https://www.weather.gov/ewx/" rel="noopener noreferrer">National Weather Service office in Austin and San Antonio</a> is worth a look the week of your event. Heat moves consumption more than headcount does.</p>
<h2>What happens at pickup</h2>
<p>Rinsing matters more than scrubbing. Empty whatever is left in the tanks, run clean water through the spouts, and wipe the outside down. That is the whole job, and it takes about ten minutes on any size.</p>
<p>We handle the deep clean and the sanitising between bookings, so nobody has to take a frozen drink machine apart on their patio. Leave the unit where it was delivered and unplug it about half an hour before the pickup window.</p>
<p>Multi-day bookings change this arithmetic. If you keep a frozen drink machine over a whole weekend, plan one mid-run rinse on the second morning so the second day tastes like the first.</p>
<h2>Power, space and the boring details</h2>
<p>Every size runs on a standard household outlet. What varies is how unhappy each one gets when it shares that outlet. Give any frozen drink machine its own circuit where you can, and keep it out of direct sun.</p>
<p>Freeze time runs about ninety minutes from filling to first pour, and it is longer on a hot day. Build that into your schedule rather than your hopes. You can check live availability by size on the <a href="/order">booking form</a> before you settle on one.</p>`,
};

const WEDDINGS: BlogSeedPost = {
  slug: "wedding-margarita-machine-ideas",
  title: "Wedding Margarita Machine Ideas for Receptions",
  excerpt:
    "Signature flavors, cocktail-hour timing, venue power and non-alcoholic options for serving frozen drinks at a San Antonio reception.",
  seoTitle: "",
  seoDescription:
    "Signature flavors, cocktail hour timing, venue power and alcohol-free options for putting a wedding margarita machine into your reception.",
  focusKeyword: "wedding margarita machine",
  coverImagePath: "/straw-daiquiri-1.jpg",
  coverImageAlt: "A frozen strawberry drink served at an outdoor reception",
  tags: ["weddings", "receptions", "san antonio"],
  body: `<h2>Where it fits in the run of show</h2>
<p>A wedding margarita machine is at its best during cocktail hour. Guests are standing, the couple is away taking photographs, and a self-serve station keeps everyone occupied without adding a second bartender to the budget.</p>
<p>It works less well during dinner service, when people are seated and a passed tray does the job better. Plan for the machine to carry the gap between the ceremony and the first dance, then let it idle.</p>
<h2>Build a signature flavor around the couple</h2>
<p>The easiest way to make a rented unit feel bespoke is the flavor card. Name each tank after something the couple actually likes and print two small signs. That one detail is what guests photograph.</p>
<h3>Pairings that hold up in photographs</h3>
<ul>
<li>Classic lime beside strawberry, for a palette that suits almost any color scheme.</li>
<li>Mango and pina colada, if the reception leans tropical or sits outdoors.</li>
<li>Blue hawaiian in a single tank, when the party wants one loud centerpiece.</li>
<li>A frozen lemonade tank, so the alcohol-free option looks identical in the glass.</li>
</ul>
<p>That last point is worth dwelling on. A wedding margarita machine that also serves a non-alcoholic tank includes designated drivers, pregnant guests and children without singling anybody out at the drinks table.</p>
<h2>Talk to your venue before you book</h2>
<p>Venues have opinions about outside alcohol, and they are not all the same. Some require a licensed bartender for anything served to guests, and a few restrict self-service entirely. Ask the coordinator in writing before you reserve a unit.</p>
<p>If your reception is at a public park or a city facility, permits enter the picture too. The <a href="https://www.tabc.texas.gov/" rel="noopener noreferrer">Texas Alcoholic Beverage Commission</a> publishes the rules for private events, and reading them takes ten minutes.</p>
<h2>Power, shade and the physical setup</h2>
<p>Outdoor receptions are where plans meet reality. The unit needs a standard outlet it does not share, a level table and shade for the compressor. Ranch venues around San Antonio often run on generators, so confirm there is a free circuit rather than assuming one.</p>
<p>Delivery two to three hours before guests arrive gives the tanks time to freeze and gives your planner time to place the table. Check the <a href="/service-area">service area pages</a> if the venue sits outside Bexar County.</p>
<h2>Rehearsal dinners and day-after brunches</h2>
<p>The reception is not the only place this works. A wedding margarita machine booked for the full weekend covers the rehearsal dinner on Friday and the send-off brunch on Sunday at the same daily rate.</p>
<p>Rehearsal dinners are smaller and more relaxed, which suits a single tank. Brunch is where a frozen lemonade or a mimosa-style batch earns its place, because half the room is easing into the day.</p>
<p>Ask about the weekend rate when you book. Spreading one wedding margarita machine across three events is usually cheaper than hiring a bartender twice, and it gives the weekend a thread that ties the three parties together.</p>
<h2>Quantities for a reception</h2>
<ul>
<li>Roughly one and a half servings per guest for a two-hour cocktail hour.</li>
<li>Two tanks for a hundred guests, three if the whole reception is outdoors.</li>
<li>One 750ml bottle of tequila per tank as a starting point.</li>
<li>Cups, ice and garnish on a separate table, so the queue keeps moving.</li>
</ul>
<h2>Booking it alongside everything else</h2>
<p>Saturdays from April through October book out first, and wedding season here overlaps exactly with the hottest months. Reserve the unit when you reserve the venue rather than in the final month.</p>
<p>Live availability for every size sits on the <a href="/order">booking form</a>, and the <a href="/pricing">pricing page</a> lists the day rate next to the extras. A wedding margarita machine is a small line on a reception budget and one of the few that guests remember by name.</p>`,
};

export const BLOG_SEED_POSTS: BlogSeedPost[] = [PLAN_A_PARTY, SIZES, WEDDINGS];
