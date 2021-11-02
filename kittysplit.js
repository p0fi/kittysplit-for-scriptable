// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: snowflake;

/*
  Config  

  Just paste the url to your kitty and the username
  you wish to track in the variables below
*/
const kittyURL = '';
const username = '';

if (config.runsInWidget) {
  const size = config.widgetFamily;
  const widget = await createWidget(size);

  Script.setWidget(widget);
  Script.complete();
} else {
  // For debugging
  const size = 'small';
  // const size = 'medium'
  // const size = 'large'
  const widget = await createWidget(size);
  if (size == 'small') {
    widget.presentSmall();
  } else if (size == 'medium') {
    widget.presentMedium();
  } else {
    widget.presentLarge();
  }
  Script.complete();
}

async function createWidget(size) {
  const data = await fetchData(kittyURL);

  if (size != 'small') {
    const widget = new ListWidget();
    widget.addText('size currently not supported');
    return widget;
  }

  const widget = new ListWidget();
  widget.url = kittyURL;
  widget.setPadding(14, 14, 14, 14); // top, leading, bot, trailing
  widget.backgroundColor = new Color('#37456B');

  const contentStack = widget.addStack();
  contentStack.layoutVertically();

  const headerStack = contentStack.addStack();
  headerStack.layoutHorizontally();

  const img = new Request('https://assets.kittysplit.com/favicon-160x160-c511202cff5614ebeaa1cce1f79e8523.png');
  const logoImg = await img.loadImage();
  const logo = headerStack.addImage(logoImg);
  logo.imageSize = new Size(35, 35);

  headerStack.addSpacer();

  const title = headerStack.addText(`${data.title}`);
  title.font = Font.boldRoundedSystemFont(23);
  title.minimumScaleFactor = 0.75;
  title.textColor = Color.white();

  contentStack.addSpacer();

  const diffStack = contentStack.addStack();
  diffStack.addSpacer();
  diffStack.layoutHorizontally();

  const diffText = data.diff === 0 ? '🤝' : `${data.diff} ${data.currency}`;
  const diff = diffStack.addText(diffText);
  diff.font = Font.boldMonospacedSystemFont(data.diff === 0 ? 70 : 40);
  diff.minimumScaleFactor = 0.75;
  const diffColor = data.diff < 0 ? Color.red() : Color.green();
  diff.textColor = diffColor;

  contentStack.addSpacer();

  const detailStack = contentStack.addStack();
  detailStack.layoutHorizontally();

  const totalIcon = detailStack.addImage(SFSymbol.named('person.2.fill').image);
  totalIcon.imageSize = new Size(20, 20);
  totalIcon.tintColor = Color.white();
  detailStack.addSpacer(3);

  const totalText = detailStack.addText(`${data.total}`);
  totalText.textColor = Color.white();
  totalText.font = Font.mediumMonospacedSystemFont(15);

  detailStack.addSpacer();
  const ownIcon = detailStack.addImage(SFSymbol.named('person.fill').image);
  ownIcon.imageSize = new Size(16, 16);
  ownIcon.tintColor = Color.white();

  detailStack.addSpacer(3);

  const ownText = detailStack.addText(`${data.own}`);
  ownText.textColor = Color.white();
  ownText.font = Font.mediumMonospacedSystemFont(15);

  return widget;
}

// Helper functions -----------------------------------------------------------
async function fetchData(kittyURL) {
  const kitty_key = kittyURL.match(/[^\/]+(?=\/$|$)/);

  let cookie = '';
  // Check keychain if there is already a cookie for that kitty
  if (Keychain.contains(`kitty-${kitty_key}`)) {
    console.log('using stored cookie...');
    cookie = Keychain.get(`kitty-${kitty_key}`);
  } else {
    console.log('no cookie found...');
    // Load selection page and find viewing_party_id
    vpid = await getViewingPartyIDForUser(username);
    // Build cookie
    cookie = btoa(`[{\"key\":\"${kitty_key}\",\"pid\":${vpid}}]`);
    // Save cookie to keychain
    Keychain.set(`kitty-${kitty_key}`, cookie);
    console.log(`stored new cookie for kitty with key: ${kitty_key}`);
  }

  // Configure request
  const req = new Request(kittyURL);
  req.headers = { Cookie: `_selected_locale=ZW4=;kittysplit_viewing_parties=${cookie}` };

  // Load request in webview and parse it
  let wv = new WebView();
  await wv.loadRequest(req);

  const titleJS = 'document.querySelector("meta[property=\'og:title\']").content';
  let title = await wv.evaluateJavaScript(titleJS);
  title = title.match(/^[^\s]+/)[0];

  const currencyJS = 'document.getElementsByClassName("currency-symbol")[0].innerText';
  const currencySymbol = await wv.evaluateJavaScript(currencyJS);

  const totalCostJS =
    'document.getElementsByClassName("kitty-stat-value")[0].getElementsByClassName("currency")[0].innerHTML';
  let totalCosts = await wv.evaluateJavaScript(totalCostJS);
  totalCosts = parsePotentiallyGroupedFloat(totalCosts.match(/([0-9]+[.,]*)+/)[0]);

  const ownCostJS =
    'document.getElementsByClassName("kitty-stat-value")[1].getElementsByClassName("currency")[0].innerHTML';
  let ownCosts = await wv.evaluateJavaScript(ownCostJS);
  ownCosts = parsePotentiallyGroupedFloat(ownCosts.match(/([0-9]+[.,]*)+/)[0]);

  const paidJS =
    'document.getElementsByClassName("kitty-stat-value")[2].getElementsByClassName("currency")[0].innerHTML';
  let paid = await wv.evaluateJavaScript(paidJS);
  paid = parsePotentiallyGroupedFloat(paid.match(/([0-9]+[.,]*)+/)[0]);

  let diff = 0;
  const diffJS = 'Array.from(document.getElementsByClassName("kitty-stat")).map((x) => x.innerHTML);';
  let diffArr = await wv.evaluateJavaScript(diffJS);
  diffArr.find((a) => {
    if (a.includes('You owe')) {
      diff = -a.match(/\d+(\.\d+)?/)[0];
      return;
    } else if (a.includes('You are owed')) {
      diff = a.match(/\d+(\.\d+)?/)[0];
      return;
    }
  });

  return {
    title: title,
    currency: currencySymbol,
    total: parseInt(totalCosts),
    own: parseInt(ownCosts),
    diff: parseInt(diff),
  };
}

function parsePotentiallyGroupedFloat(stringValue) {
  stringValue = stringValue.trim();
  var result = stringValue.replace(/[^0-9]/g, '');
  if (/[,\.]\d{2}$/.test(stringValue)) {
    result = result.replace(/(\d{2})$/, '.$1');
  }
  return parseFloat(result);
}

async function getViewingPartyIDForUser(user) {
  console.log(`tying to find viewing_party_id for ${user}...`);
  // Load party choosing page
  let wv = new WebView();
  await wv.loadURL(`${kittyURL}/parties/choose`);

  // Parse site for users
  const usersJS = 'Array.from(document.getElementsByClassName("set-viewing-party")).map((x) => x.innerHTML);';
  let users = await wv.evaluateJavaScript(usersJS);

  // Try to find viewing_party_id for that user
  const vpid = users.find((a) => a.includes(user)).match(/value="(\d+)"/)[1];
  console.log(`viewing_party_id for ${user}: ${vpid}`);
  return vpid;
}
