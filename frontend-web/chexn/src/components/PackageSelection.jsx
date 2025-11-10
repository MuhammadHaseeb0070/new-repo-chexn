import { useState, useEffect } from 'react';
import apiClient from '../apiClient.js';
import Spinner from './Spinner.jsx';
import InfoTooltip from './InfoTooltip.jsx';

function PackageSelection({ role, onPackageSelected }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPackages();
  }, [role]);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/subscriptions/packages/${role}`);
      setPackages(response.data);
      if (response.data.length > 0) {
        // Auto-select popular package or first one
        const popular = response.data.find(pkg => pkg.popular);
        setSelectedPackage(popular || response.data[0]);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      setError('Failed to load packages. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPackage = async (pkg) => {
    try {
      setProcessing(true);
      setError('');
      
      // Create checkout session
      const response = await apiClient.post('/subscriptions/create-checkout-session', {
        role,
        packageId: pkg.id
      });
      
      // Redirect to Stripe Checkout
      window.location.href = response.data.url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      setError(error.response?.data?.error || 'Failed to start checkout. Please try again.');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner label="Loading packages..." />
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No packages available for this role.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Choose Your Plan</h2>
          <p className="mt-2 text-gray-600">Select a subscription plan to get started with ChexN</p>
          <InfoTooltip description="All plans are set to $1 for testing. Prices will be updated in production." />
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-white rounded-xl border-2 shadow-sm p-6 relative ${
                pkg.popular
                  ? 'border-blue-600 ring-2 ring-blue-600 ring-opacity-50'
                  : 'border-gray-200'
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Popular
                  </span>
                </div>
              )}

              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{pkg.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">${pkg.price}</span>
                  <span className="text-gray-600 ml-2">/month</span>
                </div>

                <ul className="text-left space-y-2 mb-6">
                  {pkg.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg
                        className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="text-sm text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelectPackage(pkg)}
                  disabled={processing}
                  className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                    pkg.popular
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  } disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                >
                  {processing && selectedPackage?.id === pkg.id ? (
                    <>
                      <Spinner /> Processing...
                    </>
                  ) : (
                    'Select Plan'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>All plans are set to $1 for testing purposes.</p>
          <p>You can test the subscription flow without any charges.</p>
        </div>
      </div>
    </div>
  );
}

export default PackageSelection;

