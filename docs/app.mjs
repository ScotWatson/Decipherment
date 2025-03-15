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
  // Unigrams
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
    unigram.variance = unigram.estimate * (1 - unigram.estimate) / contents.length;
  }
  // Bigrams
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
    bigramRecord.estimate = bigramRecord.instances.length / (contents.length - 1);
    bigramRecord.variance = bigramRecord.estimate * (1 - bigramRecord.estimate) / (contents.length - 1);
    const char0Record = unigrams.get(bigramRecord.str[0]);
    const char1Record = unigrams.get(bigramRecord.str[1]);
    const char0EstimateSquared = char0Record.estimate * char0Record.estimate;
    const char1EstimateSquared = char1Record.estimate * char1Record.estimate;
    const bigramIndependentEstimate = char0Record.estimate * char1Record.estimate;
    const bigramIndependentVariance = (char0Record.variance + char0EstimateSquared) * (char1Record.variance + char1EstimateSquared) - (char0EstimateSquared * char1EstimateSquared);
    const bigramDifferenceEstimate = bigramRecord.estimate - bigramIndependentEstimate;
    const bigramDifferenceVariance = bigramRecord.variance + bigramIndependentVariance;
    const bigramDifferenceStdev = Math.sqrt(bigramDifferenceVariance);
    bigramRecord.bigramZ = bigramDifferenceEstimate / bigramDifferenceStdev;
  }
  // Trigrams
  const trigrams = new Map();
  let prevChars = contents.slice(0, 2);
  for (let i = 2; i < contents.length; ++i) {
    const char = contents[i];
    const trigram = prevChars + char;
    const record = trigrams.get(trigram);
    if (record) {
      record.instances.push(i - 1);
    } else {
      trigrams.set(trigram, {
        str: trigram,
        instances: [],
      });
    }
    prevChars = prevChars.slice(1) + char;
  }
  for (const trigramRecord of trigrams.values()) {
    const trigramCount = trigramRecord.instances.length;
    trigramRecord.estimate = trigramRecord.instances.length / (contents.length - 1);
    trigramRecord.variance = trigramRecord.estimate * (1 - trigramRecord.estimate) / (contents.length - 1);
    let trigramIndependentEstimate = 1;
    let trigramIndependentVariancePart1 = 1; // variance - estimate squared
    let trigramIndependentVariancePart2 = 1; // estimate squared
    for (let i = 0; i < 3; ++i) {
      const charRecord = unigrams.get(trigramRecord.str[i]);
      trigramIndependentEstimate *= charRecord.estimate;
      const estimateSquared = charRecord.estimate * charRecord.estimate;
      trigramIndependentVariancePart1 *= (charRecord.variance + estimateSquared);
      trigramIndependentVariancePart2 *= charRecord.variance;
    }
    const trigramIndependentVariance = trigramIndependentVariancePart1 - trigramIndependentVariancePart2;
    const trigramDifferenceEstimate = trigramRecord.estimate - trigramIndependentEstimate;
    const trigramDifferenceVariance = trigramRecord.variance + trigramIndependentVariance;
    const trigramDifferenceStdev = Math.sqrt(trigramDifferenceVariance);
    trigramRecord.trigramZ = trigramDifferenceEstimate / trigramDifferenceStdev;

    const char0Record = unigrams.get(trigramRecord.str[0]);
    const prefixRecord = bigrams.get(trigramRecord.str.slice(1));
    const suffixRecord = bigrams.get(trigramRecord.str.slice(0, 2));
    const charNRecord = unigrams.get(trigramRecord.str[2]);
    const char0EstimateSquared = char0Record.estimate * char0Record.estimate;
    const prefixEstimateSquared = prefixRecord.estimate * prefixRecord.estimate;
    const suffixEstimateSquared = suffixRecord.estimate * suffixRecord.estimate;
    const charNEstimateSquared = charNRecord.estimate * charNRecord.estimate;
    const trigramIndependentEstimate1 = char0Record.estimate * charNRecord.estimate;
    const trigramIndependentVariance1 = (char0Record.variance + char0EstimateSquared) * (suffixRecord.variance + suffixEstimateSquared) - (char0EstimateSquared * suffixEstimateSquared);
    const trigramDifferenceEstimate1 = trigramRecord.estimate - trigramIndependentEstimate1;
    const trigramDifferenceVariance1 = trigramRecord.variance + trigramIndependentVariance1;
    const trigramDifferenceStdev1 = Math.sqrt(trigramDifferenceVariance1);
    trigramRecord.trigramZ1 = trigramDifferenceEstimate1 / trigramDifferenceStdev1;
    const trigramIndependentEstimate2 = char0Record.estimate * char1Record.estimate;
    const trigramIndependentVariance2 = (prefixRecord.variance + prefixEstimateSquared) * (charNRecord.variance + charNEstimateSquared) - (prefixEstimateSquared * charNEstimateSquared);
    const trigramDifferenceEstimate2 = trigramRecord.estimate - trigramIndependentEstimate2;
    const trigramDifferenceVariance2 = trigramRecord.variance + trigramIndependentVariance2;
    const trigramDifferenceStdev2 = Math.sqrt(trigramDifferenceVariance2);
    trigramRecord.trigramZ2 = trigramDifferenceEstimate2 / trigramDifferenceStdev2;
  }
  console.log(Array.from(unigrams.values()).sort((entry1, entry2) => { return (entry1.count < entry2.count) ? 1 : -1; }));
  console.log(Array.from(bigrams.values()).sort((entry1, entry2) => { return (entry1.bigramZ < entry2.bigramZ) ? 1 : -1; }));
  console.log(Array.from(trigrams.values()).sort((entry1, entry2) => { return (entry1.trigramZ1 < entry2.trigramZ1) ? 1 : -1; }));
  console.log(Array.from(trigrams.values()).sort((entry1, entry2) => { return (entry1.trigramZ2 < entry2.trigramZ2) ? 1 : -1; }));
}
