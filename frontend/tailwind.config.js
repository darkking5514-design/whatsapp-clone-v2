/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          green: '#25D366',
          dark: '#075E54',
          teal: '#128C7E',
          panel: '#202C33',
          chatbg: '#0B141A',
          bubbleSent: '#005C4B',
          bubbleReceived: '#202C33',
        },
      },
    },
  },
  plugins: [],
};
