import axios from 'axios';

const walletData = [
  {
    url: 'https://phoenix.acinq.co',
    content: 'Phoenix is a self-custodial Lightning wallet for mobile devices. It allows users to send and receive Lightning payments with a simple, user-friendly interface. Phoenix is developed by ACINQ and supports both Android and iOS.',
    tags: 'bitcoin,lightning,wallet,phoenix,acinq,mobile,android,ios,non-custodial'
  },
  {
    url: 'https://breez.technology', 
    content: 'Breez is a non-custodial Lightning wallet that brings Bitcoin payments to every app. It offers a simple interface for sending and receiving Lightning payments with focus on user experience.',
    tags: 'bitcoin,lightning,wallet,breez,mobile,android,ios,non-custodial'
  },
  {
    url: 'https://getalby.com',
    content: 'Alby is a Bitcoin Lightning wallet and browser extension that allows users to use Bitcoin on the web, mobile and within apps. It has over 100,000 users and provides powerful, self-custodial Lightning functionality.',
    tags: 'bitcoin,lightning,wallet,alby,browser,extension,non-custodial'
  },
  {
    url: 'https://blixtwallet.github.io',
    content: 'Blixt Wallet is a non-custodial open-source Bitcoin Lightning Wallet for Android and iOS with a focus on usability and user experience.',
    tags: 'bitcoin,lightning,wallet,blixt,mobile,android,ios,non-custodial,open-source'
  },
  {
    url: 'https://bluewallet.io',
    content: 'BlueWallet is a Bitcoin wallet with Lightning Network support. It offers a simple interface for managing Bitcoin and Lightning payments, with features like Lightning channels and payment routing.',
    tags: 'bitcoin,lightning,wallet,bluewallet,mobile,android,ios'
  },
  {
    url: 'https://electrum.org',
    content: 'Electrum is a popular Bitcoin wallet with advanced features including Lightning Network support and Nostr integration. It is known for its security and extensive customization options.',
    tags: 'bitcoin,lightning,wallet,electrum,desktop,nostr,advanced'
  }
];

async function addWallets() {
  for (const wallet of walletData) {
    try {
      // Remove existing entry if it exists
      await axios.delete(`http://localhost:3000/knowledge/remove?url=${encodeURIComponent(wallet.url)}`);
      
      // Add new entry
      await axios.post('http://localhost:3000/knowledge/add', {
        url: wallet.url,
        tags: wallet.tags
      });
      
      console.log(`Added: ${wallet.url}`);
    } catch (error) {
      console.error(`Error adding ${wallet.url}:`, error.message);
    }
  }
}

addWallets(); 