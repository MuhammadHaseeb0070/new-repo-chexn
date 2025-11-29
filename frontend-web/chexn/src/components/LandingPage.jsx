import { useState } from 'react';
import Login from './login.jsx';

function LandingPage() {
  const [showLogin, setShowLogin] = useState(false);

  if (showLogin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => setShowLogin(false)}
            className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </button>
        </div>
        <Login />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header with Logo Placeholder */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo Placeholder */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">C</span>
              </div>
              <span className="text-xl font-bold text-gray-900">ChexN</span>
            </div>
            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowLogin(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Login
              </button>
              <button
                onClick={() => setShowLogin(true)}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        {/* Hero Section with Video Placeholder */}
        <section className="text-center mb-16 md:mb-24">
          {/* Animation Placeholder */}
          <div className="mb-8 flex justify-center">
            <div className="w-24 h-24 md:w-32 md:h-32 bg-blue-100 rounded-full flex items-center justify-center animate-pulse">
              <span className="text-4xl md:text-6xl">😊</span>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            ChexN Mental Health Platform
          </h1>

          {/* Video Placeholder */}
          <div className="max-w-4xl mx-auto mt-8 mb-12">
            <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-2xl aspect-video flex items-center justify-center">
              <div className="text-center text-white p-8">
                <svg className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <p className="text-sm md:text-base text-gray-300">Video Placeholder</p>
                <p className="text-xs text-gray-400 mt-2">Promotional video will be displayed here</p>
              </div>
            </div>
          </div>
        </section>

        {/* Main Description */}
        <section className="max-w-4xl mx-auto mb-16 md:mb-24">
          <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 lg:p-10 border border-gray-200">
            <p className="text-lg md:text-xl lg:text-2xl text-gray-700 leading-relaxed text-center">
              <strong className="text-gray-900">ChexN</strong> is a Mental Health Platform that uses{' '}
              <strong className="text-gray-900">Emotional Emojis</strong> to allow{' '}
              <strong className="text-gray-900">Children, Students, Athletes and Employees</strong> to{' '}
              <strong className="text-gray-900">ChexN</strong> with their{' '}
              <strong className="text-gray-900">Parents, Teachers, Teams and Employers</strong>.
            </p>
          </div>
        </section>

        {/* Ideal Customers Section */}
        <section className="max-w-5xl mx-auto mb-16 md:mb-24">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-8">
            Ideal Customers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '🏈', title: 'Professional Sports Leagues', desc: 'Monitor athlete well-being' },
              { icon: '🎓', title: 'Colleges / Universities', desc: 'Support student mental health' },
              { icon: '🏫', title: 'K-12 School Districts', desc: 'Track student emotional wellness' },
              { icon: '👨‍👩‍👧', title: 'Parents', desc: 'Stay connected with children' }
            ].map((customer, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                <div className="text-4xl mb-3 text-center">{customer.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">{customer.title}</h3>
                <p className="text-sm text-gray-600 text-center">{customer.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Types of Users Section */}
        <section className="max-w-6xl mx-auto mb-16 md:mb-24">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-10">
            Types of Users
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 border border-gray-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">👨‍👩‍👧</span>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-gray-900">1. Parents - Children</h3>
              </div>
              <p className="text-gray-600">
                Parents can monitor their children's mental health and receive real-time check-ins through emotional emoji responses.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 border border-gray-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">💼</span>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-gray-900">2. Employers - Employees</h3>
              </div>
              <p className="text-gray-600">
                Employers can track employee well-being, ensuring a healthy work environment and supporting mental wellness.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 border border-gray-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🏫</span>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-gray-900">3. Schools - Students</h3>
              </div>
              <p className="text-gray-600">
                Schools can support student mental health by enabling teachers and counselors to monitor emotional well-being.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 border border-gray-200">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🏛️</span>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-gray-900">4. School Districts - Students</h3>
              </div>
              <p className="text-gray-600">
                School districts can manage mental health programs across multiple schools, providing comprehensive wellness tracking.
              </p>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="max-w-3xl mx-auto text-center mb-16">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-xl p-8 md:p-12 text-white">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg md:text-xl mb-8 text-blue-100">
              Join ChexN today and start supporting mental wellness in your organization.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setShowLogin(true)}
                className="px-8 py-3 bg-white text-blue-600 font-semibold rounded-md hover:bg-blue-50 transition-colors"
              >
                Register Now
              </button>
              <button
                onClick={() => setShowLogin(true)}
                className="px-8 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-md hover:bg-white/10 transition-colors"
              >
                Login
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">© 2024 ChexN. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;

