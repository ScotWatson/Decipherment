/*
(c) 2025 Scot Watson  All Rights Reserved
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import * as Main from "./main.mjs";

function openFileDialog() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.style.display = "none";
    input.type = "file";
    input.addEventListener("change", (evt) => {
      resolve(input.files[0]);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}

const btnOpen = document.createElement("button");
btnOpen.append("Open File");
btnOpen.addEventListener("click", readFile);
document.body.appendChild(btnOpen);

async function readFile() {
  const file = await openFileDialog();
  const contents = await file.text();
  const unigrams = new Map();
  for (const char of contents) {
    const record = unigrams.get(char);
    if (record) {
      ++record.count;
    } else {
      unigrams.set(char, {
        char,
        count: 0,
      })
    }
  }
  for (const unigram of unigrams.values()) {
    unigram.estimate = unigram.count / contents.length;
    unigram.variance = unigram.estimate * (1 - unigram.estimate);
  }
  const bigrams = new Map();
  let prevChar = contents[0];
  for (let i = 1; i < contents.length; ++i) {
    const char = contents[i];
    const bigram = prevChar + char;
    const record = bigrams.get(bigram);
    if (record) {
      record.instances.push(i - 1);
    } else {
      bigrams.set(bigram, {
        str: bigram,
        instances: [],
      });
    }
    prevChar = char;
  }
  for (const bigramRecord of bigrams.values()) {
    const bigramCount = bigramRecord.instances.length;
    bigramRecord.char0Record = unigrams.get(bigramRecord.str[0]);
    bigramRecord.char1Record = unigrams.get(bigramRecord.str[1]);
    bigramRecord.bigramPrefixEstimate = bigramRecord.instances.length / bigramRecord.char0Record.count;
    bigramRecord.bigramPrefixVariance = bigramRecord.bigramPrefixEstimate * (1 - bigramRecord.bigramPrefixEstimate);
    bigramRecord.bigramSuffixEstimate = bigramRecord.instances.length / bigramRecord.char1Record.count;
    bigramRecord.bigramSuffixVariance = bigramRecord.bigramSuffixEstimate * (1 - bigramRecord.bigramSuffixEstimate);
    bigramRecord.prefixEstimate = bigramRecord.bigramPrefixEstimate - bigramRecord.char0Record.estimate;
    bigramRecord.prefixVariance = bigramRecord.bigramPrefixVariance + bigramRecord.char0Record.variance;
    bigramRecord.prefixStdev = Math.sqrt(bigramRecord.prefixVariance);
    bigramRecord.prefixZ = bigramRecord.prefixEstimate / bigramRecord.prefixStdev;
    bigramRecord.suffixEstimate = bigramRecord.bigramSuffixEstimate - bigramRecord.char0Record.estimate;
    bigramRecord.suffixVariance = bigramRecord.bigramSuffixVariance + bigramRecord.char0Record.variance;
    bigramRecord.suffixStdev = Math.sqrt(bigramRecord.suffixVariance);
    bigramRecord.suffixZ = bigramRecord.suffixEstimate / bigramRecord.suffixStdev;
  }
  console.log(Array.from(unigrams.values()).sort((entry1, entry2) => { return (entry1.count < entry2.count) ? 1 : -1; }));
  console.log(Array.from(bigrams.values()).sort((entry1, entry2) => { return (entry1.prefixZ < entry2.prefixZ) ? 1 : -1; }));
}
