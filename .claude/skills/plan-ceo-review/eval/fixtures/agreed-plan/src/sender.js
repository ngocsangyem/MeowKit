module.exports = async function send(url, body) {
  return fetch(url, { method: 'POST', body });
};
