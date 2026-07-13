/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Όποιος μπαίνει από το domain της τάξης προσγειώνεται κατευθείαν στη /class
      // (τη σελίδα όπου ο μαθητής γράφει το όνομα του εκπαιδευτικού και τον κωδικό τάξης).
      {
        source: '/',
        has: [{ type: 'host', value: 'leviathan-class.vercel.app' }],
        destination: '/class',
        permanent: false,
      },
    ];
  },
};
module.exports = nextConfig;
