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
        count: 1,
      })
    }
  }
  for (const unigram of unigrams.values()) {
    unigram.estimate = unigram.count / contents.length;
    unigram.variance = unigram.estimate * (1 - unigram.estimate) / contents.length;
  }
  // Bigrams
  const bigrams = countNgrams(2);
  computeBigramStatistics();
  const vettedBigrams = getVettedNgrams(bigrams);
  // Trigrams
  const trigrams = countNgrams(3);
  computeStatistics(3, trigrams);
  const vettedTrigrams = getVettedNgrams(trigrams);
  const vetted2Bigrams = crossvetNgrams(3, vettedBigrams, vettedTrigrams);
  // 4-grams
  const n4grams = countNgrams(4);
  computeStatistics(4, n4grams);
  const vettedN4grams = getVettedNgrams(n4grams);
  const vetted2Trigrams = crossvetNgrams(3, vettedTrigrams, vettedN4grams);
  console.log(Array.from(unigrams.values()).sort((entry1, entry2) => { return (entry1.count < entry2.count) ? 1 : -1; }));
  console.log(Array.from(vetted2Bigrams.values()).sort((entry1, entry2) => { return (entry1.bigramZ < entry2.bigramZ) ? 1 : -1; }));
  console.log(Array.from(vetted2Trigrams.values()).sort((entry1, entry2) => { return (entry1.trigramZ < entry2.trigramZ) ? 1 : -1; }));
  console.log(Array.from(vetted4grams.values()).sort((entry1, entry2) => { return (entry1.trigramZ < entry2.trigramZ) ? 1 : -1; }));

  function computeBigramStatistics() {
    for (const bigramRecord of bigrams.values()) {
      const bigramCount = bigramRecord.instances.size;
      bigramRecord.estimate = bigramRecord.instances.size / (contents.length - 1);
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
      bigramRecord.Z = bigramDifferenceEstimate / bigramDifferenceStdev;
      bigramRecord.Z1 = bigramRecord.Z;
      bigramRecord.Z2 = bigramRecord.Z;
    }
  }
  function countNgrams(N) {
    const ngrams = new Map();
    let prevChars = contents.slice(0, N - 1);
    for (let i = N; i < contents.length; ++i) {
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
  function computeStatistics(N, ngrams, subNgrams) {
    for (const ngramRecord of ngrams.values()) {
      const ngramCount = ngramRecord.instances.size;
      ngramRecord.estimate = ngramRecord.instances.size / (contents.length - 1);
      ngramRecord.variance = ngramRecord.estimate * (1 - ngramRecord.estimate) / (contents.length - 1);
      let ngramIndependentEstimate = 1;
      let ngramIndependentVariancePart1 = 1; // variance - estimate squared
      let ngramIndependentVariancePart2 = 1; // estimate squared
      for (let i = 0; i < N; ++i) {
        const charRecord = unigrams.get(ngramRecord.str[i]);
        ngramIndependentEstimate *= charRecord.estimate;
        const estimateSquared = charRecord.estimate * charRecord.estimate;
        ngramIndependentVariancePart1 *= (charRecord.variance + estimateSquared);
        ngramIndependentVariancePart2 *= charRecord.variance;
      }
      const ngramIndependentVariance = ngramIndependentVariancePart1 - ngramIndependentVariancePart2;
      const ngramDifferenceEstimate = ngramRecord.estimate - ngramIndependentEstimate;
      const ngramDifferenceVariance = ngramRecord.variance + ngramIndependentVariance;
      const ngramDifferenceStdev = Math.sqrt(ngramDifferenceVariance);
      ngramRecord.Z = ngramDifferenceEstimate / ngramDifferenceStdev;
      const char0Record = unigrams.get(ngramRecord.str[0]);
      const prefixRecord = subNgrams.get(ngramRecord.str.slice(1));
      const suffixRecord = subNgrams.get(ngramRecord.str.slice(0, N - 1));
      const charNRecord = unigrams.get(ngramRecord.str[N - 1]);
      const char0EstimateSquared = char0Record.estimate * char0Record.estimate;
      const prefixEstimateSquared = prefixRecord.estimate * prefixRecord.estimate;
      const suffixEstimateSquared = suffixRecord.estimate * suffixRecord.estimate;
      const charNEstimateSquared = charNRecord.estimate * charNRecord.estimate;
      const ngramIndependentEstimate1 = char0Record.estimate * suffixRecord.estimate;
      const ngramIndependentVariance1 = (char0Record.variance + char0EstimateSquared) * (suffixRecord.variance + suffixEstimateSquared) - (char0EstimateSquared * suffixEstimateSquared);
      const ngramDifferenceEstimate1 = ngramRecord.estimate - ngramIndependentEstimate1;
      const ngramDifferenceVariance1 = ngramRecord.variance + ngramIndependentVariance1;
      const ngramDifferenceStdev1 = Math.sqrt(ngramDifferenceVariance1);
      ngramRecord.Z1 = ngramDifferenceEstimate1 / ngramDifferenceStdev1;
      const ngramIndependentEstimate2 = prefixRecord.estimate * charNRecord.estimate;
      const ngramIndependentVariance2 = (prefixRecord.variance + prefixEstimateSquared) * (charNRecord.variance + charNEstimateSquared) - (prefixEstimateSquared * charNEstimateSquared);
      const ngramDifferenceEstimate2 = ngramRecord.estimate - ngramIndependentEstimate2;
      const ngramDifferenceVariance2 = ngramRecord.variance + ngramIndependentVariance2;
      const ngramDifferenceStdev2 = Math.sqrt(ngramDifferenceVariance2);
      ngramRecord.Z2 = ngramDifferenceEstimate2 / ngramDifferenceStdev2;
    }
  }
  function getVettedNgrams(Ngrams) {
    const vettedNgrams = new Map();
    for (const NgramRecord of Ngrams.values()) {
      if ((NgramRecord.Z1 > 3) || (NgramRecord.Z2 > 3)) {
        vettedNgrams.set(NgramRecord.str, {
          str: NgramRecord.str,
          instances: new Set(NgramRecord.instances),
          estimate: NgramRecord.estimate,
          variance: NgramRecord.variance,
          Z: NgramRecord.Z,
          Z1: NgramRecord.Z1,
          Z2: NgramRecord.Z2,
        });
      }
    }
  }
  function crossvetNgrams(N, subNgrams, Ngrams) {
    const vettedSubNgrams = new Map();
    for (const ngramRecord of Ngrams.values()) {
      const prefix = ngramRecord.str.slice(0, N - 1);
      if (prefix) {
        const prefixRecord = subNgrams.get(prefix);
        for (const instance of ngramRecord.instances) {
          prefixRecord.instances.remove(instance);
        }
      }
      const suffix = ngramRecord.str.slice(1);
      if (suffix) {
        const suffixRecord = subNgrams.get(suffix);
        for (const instance of ngramRecord.instances) {
          suffixRecord.instances.remove(instance + 1);
        }
      }
    }
    computeStatistics(2, bigrams);
    return getVettedNgrams(bigrams);
  }
}
