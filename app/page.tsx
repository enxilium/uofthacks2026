"use client";

import { useState } from "react";
import { generateNewSession, getCurrentSessionId, trackEvent } from "@/lib/tracking";

const cartItems = [
  { id: 1, name: "Classic Oxford Shirt", price: 89, quantity: 1, emoji: "👔", size: "M", color: "White" },
  { id: 2, name: "Slim Fit Chinos", price: 79, quantity: 2, emoji: "👖", size: "32", color: "Khaki" },
  { id: 3, name: "Wool Blend Blazer", price: 249, quantity: 1, emoji: "🧥", size: "L", color: "Navy" },
];

export default function CheckoutPage() {
  const [items, setItems] = useState(cartItems);
  const [formData, setFormData] = useState({
    email: "",
    confirmEmail: "",
    firstName: "",
    middleName: "",
    lastName: "",
    phone: "",
    altPhone: "",
    address: "",
    address2: "",
    city: "",
    state: "",
    zipCode: "",
    country: "United States",
    company: "",
    taxId: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
    nameOnCard: "",
    securityQuestion: "",
    securityAnswer: "",
    deliveryInstructions: "",
    newsletter: false,
    terms: false,
    marketing: false,
  });
  const [sessionId, setSessionId] = useState<string>(() => {
    // Initialize safely for SSR, but get value immediately on client
    if (typeof window !== "undefined") {
      return getCurrentSessionId();
    }
    return "";
  });

  // Simulate a new user (for demo)
  const handleSimulateNewUser = () => {
    const newId = generateNewSession();
    setSessionId(newId);
    // Track a page view as the new user
    trackEvent('page_view');
    // Reload to reset the form and simulate fresh user experience
    window.location.reload();
  };

  const updateQuantity = (id: number, delta: number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = 12.99;
  const handling = 4.99;
  const processingFee = subtotal * 0.029;
  const tax = subtotal * 0.0875;
  const total = subtotal + shipping + handling + processingFee + tax;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalData = {
      ...formData,
    };
    console.log("Order submitted with data:", finalData);
    
    alert("Order placed successfully! Thank you for shopping with LUXE.");
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <span className="text-8xl mb-6 block">🛒</span>
          <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
          <p className="text-gray-600 mb-8">Looks like you haven&apos;t added anything yet.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-black text-white px-6 py-3 rounded-full font-medium hover:bg-gray-800"
          >
            Reset Cart
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-red-100 via-yellow-50 to-green-100">
      {/* Overwhelming banners */}
      <div className="bg-red-300 text-red-900 text-[10px] py-1 text-center animate-pulse">
        🚨 URGENT: Prices may increase in 3 minutes. Complete now to lock in your deal.
      </div>
      <div className="bg-yellow-300 text-yellow-900 text-xs py-2 text-center">
        ⚠️ Limited time offer! Use code SAVE10 at checkout. Also check out our new arrivals! Free shipping on orders over $500. Terms apply. See details. Member exclusive deals available.
      </div>
      <div className="bg-blue-200 text-blue-900 text-[10px] py-1 text-center">
        🎉 Bonus: Fill out every field to unlock a mystery gift (maybe).
      </div>
      
      <div className="max-w-7xl mx-auto px-2 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-black uppercase tracking-widest text-gray-700">
            Secure Checkout (Maybe)
          </h1>
          <div className="flex gap-2 text-xs text-gray-500">
            <button className="hover:underline">Help</button>
            <span>|</span>
            <button className="hover:underline">FAQ</button>
          </div>
        </div>

        {/* Progress steps - confusing */}
        <div className="flex items-center justify-center gap-2 mb-2 text-[10px] text-gray-400">
          <span className="px-2 py-1 bg-gray-300 rounded">1. Review</span>
          <span>→</span>
          <span className="px-2 py-1 bg-gray-300 rounded">2. Info</span>
          <span>→</span>
          <span className="px-2 py-1 bg-gray-300 rounded">3. Shipping</span>
          <span>→</span>
          <span className="px-2 py-1 bg-gray-300 rounded">4. Payment</span>
          <span>→</span>
          <span className="px-2 py-1 bg-gray-200 rounded">5. Confirm</span>
        </div>
        <div className="text-center text-[10px] text-gray-500 mb-4">
          Step 2.5: Verification • Step 3.5: Confirm Address • Step 4.5: Re-Confirm Address
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Left Column - Form */}
          <div className="lg:col-span-3 space-y-4">
            {/* Contact Information */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <h2 className="text-xs font-semibold mb-3 text-gray-700 uppercase">Contact Information (Required)</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                    placeholder="Email"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">
                    Confirm Email *
                  </label>
                  <input
                    type="email"
                    name="confirmEmail"
                    value={formData.confirmEmail}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                    placeholder="Re-enter email"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                    placeholder="(XXX) XXX-XXXX"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">
                    Alternate Phone (Required)
                  </label>
                  <input
                    type="tel"
                    name="altPhone"
                    value={formData.altPhone}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                    placeholder="Backup phone"
                  />
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <h2 className="text-sm font-semibold mb-3 text-gray-700">Shipping Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">First Name *</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Middle Name *</label>
                  <input
                    type="text"
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Last Name *</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] text-gray-500 mb-1">Address Line 1 *</label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Address Line 2</label>
                  <input
                    type="text"
                    name="address2"
                    value={formData.address2}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">City *</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">State/Province *</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">ZIP/Postal *</label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Company (Required)</label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Tax ID (Required)</label>
                  <input
                    type="text"
                    name="taxId"
                    value={formData.taxId}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-[10px] text-gray-500 mb-1">Country *</label>
                  <select
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                  >
                    <option>United States</option>
                    <option>Canada</option>
                    <option>United Kingdom</option>
                    <option>Australia</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <h2 className="text-xs font-semibold mb-3 text-gray-700">Payment Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="md:col-span-2">
                  <label className="block text-[10px] text-gray-500 mb-1">Card Number *</label>
                  <input
                    type="text"
                    name="cardNumber"
                    value={formData.cardNumber}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                    placeholder="XXXX XXXX XXXX XXXX"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Exp. (MM/YY) *</label>
                  <input
                    type="text"
                    name="expiry"
                    value={formData.expiry}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">CVV/CVC *</label>
                  <input
                    type="text"
                    name="cvc"
                    value={formData.cvc}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-[10px] text-gray-500 mb-1">Cardholder Name *</label>
                  <input
                    type="text"
                    name="nameOnCard"
                    value={formData.nameOnCard}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-gray-400"
                  />
                </div>
              </div>
              
              {/* Billing address - extra friction */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <label className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                  <input 
                    type="checkbox" 
                    className="w-3 h-3" 
                    checked={true}
                    readOnly
                  />
                  Billing address same as shipping
                </label>
                <p className="text-xs text-gray-500 italic">
                  Billing address must match shipping address for security.
                </p>
              </div>
            </div>

            {/* Confusing checkboxes */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <h2 className="text-xs font-semibold mb-3 text-gray-700">Preferences & Agreements</h2>
              <div className="space-y-3">
                <label className="flex items-start gap-2 text-xs text-gray-600">
                  <input 
                    type="checkbox" 
                    name="newsletter"
                    checked={formData.newsletter}
                    onChange={handleInputChange}
                    className="w-3 h-3 mt-0.5" 
                  />
                  <span>Yes, I would like to receive promotional emails, special offers, and marketing communications from LUXE and its affiliated partners. You can unsubscribe at any time by clicking the link in the footer of our emails.</span>
                </label>
                <label className="flex items-start gap-2 text-xs text-gray-600">
                  <input 
                    type="checkbox" 
                    name="marketing"
                    checked={formData.marketing}
                    onChange={handleInputChange}
                    className="w-3 h-3 mt-0.5" 
                  />
                  <span>I agree to share my information with third-party partners for personalized advertising purposes. See our privacy policy for more details about how we use your data.</span>
                </label>
                <label className="flex items-start gap-2 text-xs text-gray-600">
                  <input 
                    type="checkbox" 
                    name="terms"
                    checked={formData.terms}
                    onChange={handleInputChange}
                    className="w-3 h-3 mt-0.5" 
                  />
                  <span>I have read and agree to the Terms of Service, Privacy Policy, Return Policy, and Shipping Terms. I understand that all sales are subject to availability and that prices may change without notice.</span>
                </label>
              </div>
            </div>

            {/* Extra verification friction */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <h2 className="text-xs font-semibold mb-3 text-gray-700">Security Verification (Required)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Security Question *</label>
                  <select
                    name="securityQuestion"
                    value={formData.securityQuestion}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none"
                  >
                    <option value="">Select one...</option>
                    <option>First pet&apos;s middle name?</option>
                    <option>Favorite tax form?</option>
                    <option>Childhood street spelled backwards?</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Security Answer *</label>
                  <input
                    type="text"
                    name="securityAnswer"
                    value={formData.securityAnswer}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] text-gray-500 mb-1">Delivery Instructions (Required)</label>
                  <input
                    type="text"
                    name="deliveryInstructions"
                    value={formData.deliveryInstructions}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none"
                    placeholder="Provide detailed delivery directions"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 sticky top-20">
              <h2 className="text-xs font-semibold mb-1 text-gray-500 uppercase">Order Summary (Final-ish)</h2>
              <p className="text-[10px] text-gray-400 mb-3">Totals update every 3-7 minutes</p>
              
              {/* Cart Items - cramped */}
              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-2 text-xs border-b border-gray-100 pb-2">
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">{item.emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-gray-700">{item.name}</p>
                      <p className="text-gray-400">{item.size} / {item.color}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-4 h-4 rounded bg-gray-200 text-xs hover:bg-gray-300"
                        >
                          -
                        </button>
                        <span className="text-xs px-1">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-4 h-4 rounded bg-gray-200 text-xs hover:bg-gray-300"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-gray-400 ml-1 hover:text-gray-600"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <div className="text-right text-gray-600">
                      ${item.price * item.quantity}
                    </div>
                  </div>
                ))}
              </div>

              {/* Promo Code */}
              <div className="border-t border-gray-200 pt-3 mb-3">
                <div className="flex gap-1">
                  <input
                    type="text"
                    placeholder="Promo code"
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none"
                  />
                  <button className="px-2 py-1 bg-gray-200 rounded text-xs text-gray-600 hover:bg-gray-300">
                    Apply
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Enter code exactly as shown</p>
              </div>

              {/* Totals - hidden fees revealed */}
              <div className="border-t border-gray-200 pt-3 space-y-1 text-xs">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Shipping</span>
                  <span>${shipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Handling Fee</span>
                  <span>${handling.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Processing Fee (2.9%)</span>
                  <span>${processingFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Estimated Tax (8.75%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-sm pt-2 border-t border-gray-200 text-gray-700">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Confusing buttons */}
              <div className="mt-4 space-y-2">
                <button
                  onClick={handleSubmit}
                  className="w-full bg-gray-300 text-gray-500 py-2 rounded text-xs font-medium hover:bg-gray-200"
                >
                  Continue (maybe)
                </button>
                <div className="flex gap-2">
                  <button className="flex-1 border border-gray-300 text-gray-500 py-2 rounded text-xs hover:bg-gray-50">
                    Save for later
                  </button>
                  <button className="flex-1 border border-gray-300 text-gray-500 py-2 rounded text-xs hover:bg-gray-50">
                    Clear all
                  </button>
                </div>
                <button className="w-full bg-red-200 text-red-600 py-2 rounded text-xs hover:bg-red-100">
                  ⚠️ Cancel order and lose discounts
                </button>
              </div>

              {/* Tiny disclaimer */}
              <p className="text-[10px] text-gray-400 mt-3 leading-tight">
                By placing your order, you agree to our Terms of Service, Privacy Policy, and Return Policy. Orders are processed within 3-5 business days. Shipping times may vary. All sales final on clearance items. International orders may be subject to customs fees.
              </p>
            </div>
          </div>
        </div>

        {/* Trust badges - cluttered */}
        <div className="mt-6 bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-400">
            <span>🔒 Secure Checkout</span>
            <span>|</span>
            <span>💳 All Major Cards Accepted</span>
            <span>|</span>
            <span>📦 Free Returns*</span>
            <span>|</span>
            <span>🛡️ Buyer Protection</span>
            <span>|</span>
            <span>✓ Verified Merchant</span>
            <span>|</span>
            <span>📞 24/7 Support</span>
          </div>
          <p className="text-[10px] text-gray-300 text-center mt-2">
            *Free returns valid on full-price items only. Excludes final sale, swimwear, and undergarments. Return shipping fees may apply for international orders.
          </p>
        </div>

        {/* Demo Controls - Fixed bottom right */}
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white rounded-lg shadow-2xl p-4 border border-gray-700 z-50">
          <div className="text-xs text-gray-400 mb-2 font-mono">🤖 FLUXOR DEMO</div>
          <div suppressHydrationWarning className="text-[10px] text-gray-500 mb-3 font-mono truncate max-w-[200px]">
            Session: {sessionId ? sessionId.slice(0, 8) + '...' : 'None'}
          </div>
          <button
            onClick={handleSimulateNewUser}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold py-2 px-4 rounded-lg transition-all transform hover:scale-105 active:scale-95"
          >
            🆕 Simulate New User
          </button>
          <p className="text-[10px] text-gray-500 mt-2 text-center">
            Triggers AI analysis
          </p>
        </div>
      </div>
    </div>
  );
}


