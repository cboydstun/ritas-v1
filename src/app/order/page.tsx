import OrderForm from "@/components/order/OrderForm";

export default function OrderPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-light via-margarita/10 to-teal/20 py-12 relative">
      {/* Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-orange/10 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-pink/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-40 right-20 w-24 h-24 bg-margarita/10 rounded-full blur-xl animate-pulse" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="mb-8 inline-block">
            <span className="inline-block px-4 py-2 rounded-full bg-margarita/20 text-charcoal text-sm font-semibold tracking-wide uppercase animate-bounce">
              🎉 Let's Get Started
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-charcoal mb-6 tracking-tight">
            Book Your
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-margarita via-teal to-orange mt-2">
              Margarita Service
            </span>
          </h1>
          <p className="text-xl text-charcoal/70 max-w-2xl mx-auto">
            Fill out the form below to start your booking process. We'll help
            you create the perfect frozen drink experience for your event.
          </p>
        </div>
        <OrderForm />
      </div>
    </div>
  );
}
