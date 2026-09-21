// Bank Basher Offline & Live RGS Interceptor
(function() {
  // 1. Ensure default query parameters
  const params = new URLSearchParams(window.location.search);
  let dirty = false;
  if (!params.has('sessionID')) {
    params.set('sessionID', 'a___o9M2XASyk6ta_bCzQMo-c5kp5vD7zr7CUuInlThGlkW2gg62MM1DZJPvq59bbD2X_oVvwipICWWy2TsIuQ');
    dirty = true;
  }
  if (!params.has('rgs_url')) {
    params.set('rgs_url', 'rgsd.engine.io');
    dirty = true;
  }
  if (!params.has('lang')) {
    params.set('lang', 'en');
    dirty = true;
  }
  if (!params.has('currency')) {
    params.set('currency', 'USD');
    dirty = true;
  }
  if (!params.has('device')) {
    params.set('device', 'desktop');
    dirty = true;
  }
  if (!params.has('social')) {
    params.set('social', 'false');
    dirty = true;
  }
  if (!params.has('demo')) {
    params.set('demo', 'true');
    dirty = true;
  }
  if (dirty) {
    const newUrl = window.location.pathname + '?' + params.toString() + window.location.hash;
    window.history.replaceState(null, '', newUrl);
  }

  // 2. State tracking for offline fallback
  let localBalance = 1000000000; // $10,000.00
  window.__bbBalance = localBalance;

  const symbols = ['L1', 'L2', 'L3', 'L4', 'H1', 'H2', 'H3', 'H4'];
  const prizeValues = [500, 1000, 1500, 2000, 2500, 5000, 10000];
  function randomChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function generateMockRound(betAmount, mode) {
    const hasBoxer = mode === 'ANTE' || Math.random() < 0.35;
    const board = [];
    for (let c = 0; c < 5; c++) {
      const col = [];
      for (let r = 0; r < 6; r++) {
        const rand = Math.random();
        if (rand < 0.12) {
          col.push({ name: 'P', scatter: true, prize: randomChoice(prizeValues) });
        } else if (rand < 0.15) {
          col.push({ name: 'X' });
        } else {
          col.push({ name: randomChoice(symbols) });
        }
      }
      board.push(col);
    }

    if (hasBoxer) {
      const boxerCol = Math.floor(Math.random() * 3);
      const boxerRow = 1 + Math.floor(Math.random() * 4);
      board[boxerCol][boxerRow] = { name: 'B', boxer: true };
      board[boxerCol + 1][boxerRow] = { name: 'P', scatter: true, prize: randomChoice(prizeValues) };
    }

    const state = [
      {
        index: 0,
        type: 'reveal',
        board: board,
        paddingPositions: [
          Math.floor(Math.random() * 50),
          Math.floor(Math.random() * 50),
          Math.floor(Math.random() * 50),
          Math.floor(Math.random() * 50),
          Math.floor(Math.random() * 50)
        ],
        gameType: 'basegame',
        anticipation: [0, 0, 0, 0, 0]
      }
    ];

    let nextIndex = 1;

    if (hasBoxer) {
      let bCol = -1, bRow = -1;
      for (let c = 0; c < 5; c++) {
        for (let r = 1; r <= 4; r++) {
          if (board[c][r].name === 'B') {
            bCol = c;
            bRow = r;
            break;
          }
        }
        if (bCol !== -1) break;
      }

      if (bCol !== -1 && bCol < 4) {
        const targetCol = bCol + 1;
        const prize = board[targetCol][bRow].prize || 1000;
        state.push({
          index: nextIndex++,
          type: 'boxerSpawn',
          boxerPosition: { reel: bCol, row: bRow },
          punchesRemaining: 1,
          isNearMiss: false
        });
        state.push({
          index: nextIndex++,
          type: 'boxerPunch',
          punchInfo: {
            boxerPosition: { reel: bCol, row: bRow },
            targetPosition: { reel: targetCol, row: bRow },
            punchesRewarded: 1,
            prize: prize,
            punchType: 'normal'
          }
        });
        state.push({
          index: nextIndex++,
          type: 'tumbleBoard',
          explodingSymbols: [{ reel: targetCol, row: bRow }],
          newSymbols: [{ name: randomChoice(symbols) }]
        });
        state.push({
          index: nextIndex++,
          type: 'boxerEnd'
        });
      }
    }

    state.push({
      index: nextIndex++,
      type: 'setTotalWin',
      amount: 0
    });

    state.push({
      index: nextIndex++,
      type: 'finalWin',
      amount: 0
    });

    localBalance -= (betAmount || 1000000);
    window.__bbBalance = localBalance;

    return {
      round: {
        betID: Date.now(),
        amount: betAmount || 1000000,
        payout: 0,
        payoutMultiplier: 0.0,
        active: false,
        mode: mode || 'BASE',
        state: state
      },
      balance: {
        amount: localBalance,
        currency: 'USD'
      }
    };
  }

  // 3. Wrap window.fetch
  const origFetch = window.fetch;
  window.fetch = async function(url, options) {
    const urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : '');

    // Redirect remote translations to local files
    if (urlStr.includes('/translations/')) {
      const match = urlStr.match(/\/translations\/([^?#]+)/);
      if (match) {
        const localUrl = './translations/' + match[1];
        return origFetch.call(this, localUrl, options);
      }
    }

    // Intercept wallet / authenticate
    if (urlStr.includes('/wallet/authenticate')) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const mergedOpts = { ...options, signal: controller.signal };
        const res = await origFetch.call(this, url, mergedOpts);
        clearTimeout(timer);
        if (res.ok) {
          const clone = res.clone();
          const data = await clone.json();
          if (data && data.balance && data.balance.amount) {
            localBalance = data.balance.amount;
            window.__bbBalance = localBalance;
            return res;
          }
        }
      } catch (err) {
        console.warn('[Bank Basher Offline] Wallet auth falling back to offline mode:', err.message);
      }

      // Offline fallback for authenticate
      const mockAuth = {
        balance: { amount: localBalance, currency: 'USD' },
        config: {
          gameID: '1_31_97',
          minBet: 100000,
          maxBet: 1000000000,
          stepBet: 10000,
          defaultBetLevel: 1000000,
          betLevels: [100000, 200000, 400000, 600000, 800000, 1000000, 1200000, 1400000, 1600000, 1800000, 2000000, 3000000, 4000000, 5000000, 6000000, 7000000, 8000000, 9000000, 10000000, 12000000, 14000000, 16000000, 18000000, 20000000, 30000000, 40000000, 50000000, 75000000, 100000000, 150000000, 200000000, 250000000, 300000000, 350000000, 400000000, 450000000, 500000000, 750000000, 1000000000],
          jurisdiction: { socialCasino: false }
        }
      };
      return new Response(JSON.stringify(mockAuth), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Intercept wallet / play
    if (urlStr.includes('/wallet/play')) {
      let bodyData = {};
      try {
        if (options && options.body) {
          bodyData = JSON.parse(options.body);
        }
      } catch (_) {}

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const mergedOpts = { ...options, signal: controller.signal };
        const res = await origFetch.call(this, url, mergedOpts);
        clearTimeout(timer);
        if (res.ok) {
          const clone = res.clone();
          const data = await clone.json();
          if (data && data.round && data.round.state && data.round.state.length > 0) {
            if (data.balance && data.balance.amount) {
              localBalance = data.balance.amount;
              window.__bbBalance = localBalance;
            }
            return res;
          }
        }
      } catch (err) {
        console.warn('[Bank Basher Offline] Play falling back to local math generator:', err.message);
      }

      // Offline fallback for play
      const mockPlay = generateMockRound(bodyData.amount, bodyData.mode);
      return new Response(JSON.stringify(mockPlay), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Intercept wallet / end-round or bet / event
    if (urlStr.includes('/wallet/end-round') || urlStr.includes('/bet/event')) {
      try {
        const res = await origFetch.call(this, url, options);
        if (res.ok) return res;
      } catch (_) {}
      return new Response(JSON.stringify({ balance: { amount: localBalance, currency: 'USD' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return origFetch.call(this, url, options);
  };
})();
