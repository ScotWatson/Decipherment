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
  for (const unigram of unigrams) {
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
  for (const bigramRecord of bigrams) {
    const bigramCount = bigramRecord.instances.length;
    const char0Record = unigrams.get(bigramRecord.str[0]);
    const char1Record = unigrams.get(bigramRecord.str[1]);
    const bigramPrefixEstimate = bigramRecord.instances.length / char0Record.count;
    const bigramPrefixVariance = bigramPrefixEstimate * (1 - bigramPrefixEstimate);
    const bigramSuffixEstimate = bigramRecord.instances.length / char1Record.count;
    const bigramSuffixVariance = bigramSuffixEstimate * (1 - bigramSuffixEstimate);
    const prefixEstimate = bigramPrefixEstimate - char0Record.estimate;
    const prefixVariance = bigramPrefixVariance + char0Record.variance;
    const prefixStdev = Math.sqrt(prefixVariance);
    bigramRecord.prefixZ = prefixEstimate / prefixStdev;
    const suffixEstimate = bigramSuffixEstimate - char0Record.estimate;
    const suffixVariance = bigramSuffixVariance + char0Record.variance;
    const suffixStdev = Math.sqrt(suffixVariance);
    bigramRecord.suffixZ = suffixEstimate / suffixStdev;
  }
  console.log(Array.from(unigrams.entries()).sort((entry1, entry2) => { return (entry1[1].count < entry2[1].count) ? 1 : -1; }));
  console.log(Array.from(bigrams.entries()).sort((entry1, entry2) => { return (entry1[1].prefixZ < entry2[1].prefixZ) ? 1 : -1; }));
}
