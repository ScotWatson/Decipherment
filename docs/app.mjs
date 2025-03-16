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

const thresholdZ = 5;
const reliableZ = 3;

async function readFile() {
  const reliableZSquared = reliableZ * reliableZ;
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
        count: 1,
      })
    }
  }
  for (const unigramRecord of unigrams.values()) {
    const p = unigramRecord.count / contents.length;
    if (contents.length * p / (1 - p) <= reliableZSquared) {
      unigramRecord.estimate = Math.NaN;
      unigramRecord.variance = Math.NaN;
      continue;
    }
    unigramRecord.estimate = p;
    unigramRecord.variance = unigramRecord.estimate * (1 - unigramRecord.estimate) / contents.length;
  }
  // Bigrams
  const bigrams = countNgrams(2);
  computeBigramStatistics(bigrams);
  const vettedBigrams = getVettedNgrams(bigrams);
  // Trigrams
  const trigrams = countNgrams(3);
  computeStatistics(3, trigrams, bigrams);
  const vettedTrigrams = getVettedNgrams(trigrams);
  crossvetNgrams(3, vettedTrigrams, vettedBigrams);
  computeBigramStatistics(vettedBigrams);
  const crossVettedBigrams = getVettedNgrams(vettedBigrams);
  // 4-grams
  const n4grams = countNgrams(4);
  computeStatistics(4, n4grams, trigrams);
  const vetted4grams = getVettedNgrams(n4grams);
  crossvetNgrams(4, vetted4grams, vettedTrigrams);
  computeStatistics(3, vettedTrigrams, bigrams);
  const crossVettedTrigrams = getVettedNgrams(vettedTrigrams);
  computeStatistics(4, vetted4grams, trigrams);
  console.log(Array.from(unigrams.values()).sort((entry1, entry2) => { return (entry1.count < entry2.count) ? 1 : -1; }));
  console.log(Array.from(crossVettedBigrams.values()).sort((entry1, entry2) => { return (entry1.Z < entry2.Z) ? 1 : -1; }));
  console.log(Array.from(crossVettedTrigrams.values()).sort((entry1, entry2) => { return (entry1.Z < entry2.Z) ? 1 : -1; }));
  console.log(Array.from(vetted4grams.values()).sort((entry1, entry2) => { return (entry1.Z < entry2.Z) ? 1 : -1; }));

  function countNgrams(N) {
    const ngrams = new Map();
    let prevChars = contents.slice(0, N - 1);
    for (let i = N - 1; i < contents.length; ++i) {
      const char = contents[i];
      const ngram = prevChars + char;
      const record = ngrams.get(ngram);
      if (record) {
        record.instances.add(i - N + 1);
      } else {
        ngrams.set(ngram, {
          str: ngram,
          instances: new Set([ i - N + 1 ]),
        });
      }
      prevChars = prevChars.slice(1) + char;
    }
    return ngrams;
  }
  function computeBigramStatistics(bigrams) {
    for (const bigramRecord of bigrams.values()) {
      const bigramCount = bigramRecord.instances.size;
      const p = bigramRecord.instances.size / (contents.length - 1);
      if ((contents.length - N + 1) * p / (1 - p) <= reliableZSquared) {
        bigramRecord.estimate = Math.NaN;
        bigramRecord.variance = Math.NaN;
        bigramRecord.Z = Math.NaN;
        bigramRecord.Z1 = Math.NaN;
        bigramRecord.Z2 = Math.NaN;
        continue;
      }
      bigramRecord.estimate = bigramRecord.instances.size / (contents.length - 1);
      bigramRecord.variance = bigramRecord.estimate * (1 - bigramRecord.estimate) / (contents.length - 1);
      const char0Record = unigrams.get(bigramRecord.str[0]);
      const char1Record = unigrams.get(bigramRecord.str[1]);
      if (Math.isNaN(char0Record.estimate) || Math.isNaN(char1Record.estimate)) {
        bigramRecord.Z = Math.NaN;
        bigramRecord.Z1 = Math.NaN;
        bigramRecord.Z2 = Math.NaN;
        continue;
      }
      const char0EstimateSquared = char0Record.estimate * char0Record.estimate;
      const char1EstimateSquared = char1Record.estimate * char1Record.estimate;
      const bigramIndependentEstimate = char0Record.estimate * char1Record.estimate;
      const bigramIndependentVariance = (char0Record.variance + char0EstimateSquared) * (char1Record.variance + char1EstimateSquared) - (char0EstimateSquared * char1EstimateSquared);
      const bigramDifferenceEstimate = bigramRecord.estimate - bigramIndependentEstimate;
      const bigramDifferenceVariance = bigramRecord.variance + bigramIndependentVariance;
      const bigramDifferenceStdev = Math.sqrt(bigramDifferenceVariance);
      bigramRecord.Z = bigramDifferenceEstimate / bigramDifferenceStdev;
      bigramRecord.Z1 = bigramRecord.Z;
      bigramRecord.Z2 = bigramRecord.Z;
    }
  }
  function computeStatistics(N, ngrams, subNgrams) {
    for (const ngramRecord of ngrams.values()) {
      const p = ngramRecord.instances.size / (contents.length - N + 1);
      if ((contents.length - N + 1) * p / (1 - p) <= reliableZSquared) {
        ngramRecord.estimate = Math.NaN;
        ngramRecord.variance = Math.NaN;
        ngramRecord.Z = Math.NaN;
        ngramRecord.Z1 = Math.NaN;
        ngramRecord.Z2 = Math.NaN;
        continue;
      }
      ngramRecord.estimate = p;
      ngramRecord.variance = ngramRecord.estimate * (1 - ngramRecord.estimate) / (contents.length - 1);
      let ngramIndependentEstimate = 1;
      let ngramIndependentVariancePart1 = 1; // variance - estimate squared
      let ngramIndependentVariancePart2 = 1; // estimate squared
      for (let i = 0; i < N; ++i) {
        const charRecord = unigrams.get(ngramRecord.str[i]);
        ngramIndependentEstimate *= charRecord.estimate;
        const estimateSquared = charRecord.estimate * charRecord.estimate;
        ngramIndependentVariancePart1 *= (charRecord.variance + estimateSquared);
        ngramIndependentVariancePart2 *= estimateSquared;
      }
      const ngramIndependentVariance = ngramIndependentVariancePart1 - ngramIndependentVariancePart2;
      const ngramDifferenceEstimate = ngramRecord.estimate - ngramIndependentEstimate;
      const ngramDifferenceVariance = ngramRecord.variance + ngramIndependentVariance;
      const ngramDifferenceStdev = Math.sqrt(ngramDifferenceVariance);
      ngramRecord.Z = ngramDifferenceEstimate / ngramDifferenceStdev;
      const char0Record = unigrams.get(ngramRecord.str[0]);
      const suffixRecord = subNgrams.get(ngramRecord.str.slice(1));
      const prefixRecord = subNgrams.get(ngramRecord.str.slice(0, N - 1));
      const charNRecord = unigrams.get(ngramRecord.str[N - 1]);
      const char0EstimateSquared = char0Record.estimate * char0Record.estimate;
      const prefixEstimateSquared = prefixRecord.estimate * prefixRecord.estimate;
      const suffixEstimateSquared = suffixRecord.estimate * suffixRecord.estimate;
      const charNEstimateSquared = charNRecord.estimate * charNRecord.estimate;
      if (Math.isNaN(char0Record.estimate) || Math.isNaN(suffixRecord.estimate)) {
        ngramRecord.Z1 = Math.NaN;
      } else {
        const ngramIndependentEstimate1 = char0Record.estimate * suffixRecord.estimate;
        const ngramIndependentVariance1 = (char0Record.variance + char0EstimateSquared) * (suffixRecord.variance + suffixEstimateSquared) - (char0EstimateSquared * suffixEstimateSquared);
        const ngramDifferenceEstimate1 = ngramRecord.estimate - ngramIndependentEstimate1;
        const ngramDifferenceVariance1 = ngramRecord.variance + ngramIndependentVariance1;
        const ngramDifferenceStdev1 = Math.sqrt(ngramDifferenceVariance1);
        ngramRecord.Z1 = ngramDifferenceEstimate1 / ngramDifferenceStdev1;
      }
      if (Math.isNaN(prefixRecord.estimate) || Math.isNaN(charNRecord.estimate)) {
        ngramRecord.Z2 = Math.NaN;
      } else {
        const ngramIndependentEstimate2 = prefixRecord.estimate * charNRecord.estimate;
        const ngramIndependentVariance2 = (prefixRecord.variance + prefixEstimateSquared) * (charNRecord.variance + charNEstimateSquared) - (prefixEstimateSquared * charNEstimateSquared);
        const ngramDifferenceEstimate2 = ngramRecord.estimate - ngramIndependentEstimate2;
        const ngramDifferenceVariance2 = ngramRecord.variance + ngramIndependentVariance2;
        const ngramDifferenceStdev2 = Math.sqrt(ngramDifferenceVariance2);
        ngramRecord.Z2 = ngramDifferenceEstimate2 / ngramDifferenceStdev2;
      }
    }
  }
  function getVettedNgrams(ngrams) {
    const vettedNgrams = new Map();
    for (const ngramRecord of ngrams.values()) {
      if (!Math.isNaN(ngramRecord.Z1) && !Math.isNaN(ngramRecord.Z2) && ((ngramRecord.Z1 > thresholdZ) || (ngramRecord.Z2 > thresholdZ))) {
        vettedNgrams.set(ngramRecord.str, {
          str: ngramRecord.str,
          instances: new Set(ngramRecord.instances),
        });
      }
    }
    return vettedNgrams;
  }
  function crossvetNgrams(N, vettedNgrams, vettedSubNgrams) {
    for (const ngramRecord of vettedNgrams.values()) {
      const prefix = ngramRecord.str.slice(0, N - 1);
      const prefixRecord = vettedSubNgrams.get(prefix);
      if (prefixRecord) {
        for (const instance of ngramRecord.instances) {
          prefixRecord.instances.delete(instance);
        }
      }
      const suffix = ngramRecord.str.slice(1);
      const suffixRecord = vettedSubNgrams.get(suffix);
      if (suffixRecord) {
        for (const instance of ngramRecord.instances) {
          suffixRecord.instances.delete(instance + 1);
        }
      }
    }
  }
}
