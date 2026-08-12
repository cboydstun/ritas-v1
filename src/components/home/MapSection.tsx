import Link from "next/link";
import {
  SERVICE_AREA_REGIONS,
  serviceAreasByRegion,
} from "@/lib/service-areas";

export default function MapSection() {
  return (
    <div className="bg-white dark:bg-charcoal py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-charcoal dark:text-white mb-4">
            Service Area
          </h2>
          <p className="text-lg text-charcoal/80 dark:text-white/80">
            Proudly serving San Antonio and surrounding areas
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* The iframe used to be nested in a centred flex box with a 64px
              map-pin SVG drawn on top of it, at a fixed 800x600 — so it was
              hard-clipped at every viewport, had a pin over the middle, and
              contributed layout shift. It now fills its own aspect box. */}
          <div className="relative aspect-video bg-light dark:bg-charcoal/50 rounded-lg overflow-hidden">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d286869.7536512927!2d-98.59373990853682!3d29.46675923764449!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x865c58af04d00eaf%3A0x856e13b10a016bc!2sSan%20Antonio%2C%20TX!5e1!3m2!1sen!2sus!4v1737150488930!5m2!1sen!2sus"
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Map of SATX Ritas service area in San Antonio"
              allow="fullscreen"
            />
          </div>

          {/* Service Areas List */}
          <div>
            <h3 className="text-xl font-semibold text-charcoal dark:text-white mb-6">
              Areas We Serve
            </h3>
            {/* Rendered from SERVICE_AREAS so each neighbourhood links to
                its own page — this was 16 inert <li>s of exactly the local
                vocabulary the site had nothing to rank for. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SERVICE_AREA_REGIONS.map((region) => (
                <div key={region}>
                  <h4 className="font-semibold text-teal mb-3">{region}</h4>
                  <ul className="space-y-2 text-charcoal/80 dark:text-white/80">
                    {serviceAreasByRegion(region).map((area) => (
                      <li key={area.slug}>
                        <Link
                          href={`/service-area/${area.slug}`}
                          className="hover:text-margarita transition-colors"
                        >
                          {area.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-8 p-4 bg-light dark:bg-charcoal/50 rounded-lg">
              <p className="text-charcoal/80 dark:text-white/80">
                <span className="font-semibold text-teal">Note:</span> We serve
                additional areas within 30 miles of downtown San Antonio.
                Contact us to confirm service availability for your location.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
