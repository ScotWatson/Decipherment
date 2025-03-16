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

const thresholdZ = 6;
const reliableZ = 3;

async function readFile() {
  const reliableZSquared = reliableZ * reliableZ;
  const file = await openFileDialog();
  const contents = await file.text();
  const unigrams = getUnigramEstimates(contents);
  const bigrams = getNgramEstimates(2);
  const vettedBigrams = vetBigramPossibilities(bigrams, unigrams);
  const trigrams = getNgramEstimates(3);
  const vettedTrigrams = vetNgramPossibilities(3, trigrams, bigrams);
  const decimatedBigrams = decimateNgrams(2, vettedBigrams, vettedTrigrams);
  const vettedDecimatedBigrams = vetBigramPossibilities(decimatedBigrams, unigrams);
  const n4grams = getNgramEstimates(4);
  const vetted4grams = vetNgramPossibilities(4, n4grams, trigrams);
  const decimatedTrigrams = decimateNgrams(3, vettedTrigrams, vetted4grams);
  const vettedDecimatedTrigrams = vetNgramPossibilities(3, decimatedTrigrams, bigrams, unigrams);
  calculateNgramEstimates(4, vetted4grams);
  console.log(Array.from(unigrams.values()).sort((entry1, entry2) => { return (entry1.count < entry2.count) ? 1 : -1; }));
  console.log(Array.from(vettedDecimatedBigrams.values()).sort((entry1, entry2) => { return (entry1.Z < entry2.Z) ? 1 : -1; }));
  console.log(Array.from(vettedDecimatedTrigrams.values()).sort((entry1, entry2) => { return (entry1.Z < entry2.Z) ? 1 : -1; }));
  console.log(Array.from(vetted4grams.values()).sort((entry1, entry2) => { return (entry1.Z < entry2.Z) ? 1 : -1; }));

  function vetBigramPossibilities(bigrams, unigrams) {
    calculateBigramProbabilities(bigrams, unigrams);
    return getVettedNgrams(bigrams);
  }
  function vetNgramPossibilities(n, ngrams, subNgrams) {
    calculateNgramProbabilities(n, ngrams, subNgrams);
    return getVettedNgrams(ngrams);
  }
  function getUnigramEstimates(contents) {
    const unigrams = countUnigrams(contents);
    calculateUnigramEstimates(unigrams);
    return unigrams;
  }
  function getBigramEstimates() {
    const bigrams = countNgrams(2);
    calculateNgramEstimates(2, bigrams);
    return bigrams;
  }
  function getNgramEstimates(n) {
    const ngrams = countNgrams(n);
    calculateNgramEstimates(n, ngrams);
    return ngrams;
  }
  function countUnigrams(contents) {
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
    return unigrams;
  }
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
  function calculateUnigramEstimates(unigrams) {
    const reliableUnigrams = new Map();
    for (const unigramRecord of unigrams.values()) {
      const p = unigramRecord.count / contents.length;
      if (contents.length * p / (1 - p) > reliableZSquared) {
        reliableUnigrams.set(unigramRecord.str, unigramRecord);
        unigramRecord.estimate = p;
        unigramRecord.variance = p * (1 - p) / contents.length;
      }
    }
    return reliableUnigrams;
  }
  function calculateNgramEstimates(N, ngrams) {
    const reliableNgrams = new Map();
    for (const ngramRecord of ngrams.values()) {
      const p = ngramRecord.instances.size / (contents.length - N + 1);
      if ((contents.length - N + 1) * p / (1 - p) > reliableZSquared) {
        reliableNgrams.set(ngramRecord.str, ngramRecord);
        ngramRecord.estimate = p;
        ngramRecord.variance = p * (1 - p) / (contents.length - 1);
      }
    }
    return reliableNgrams;
  }
  function calculateBigramProbabilities(bigrams, unigrams) {
    for (const bigramRecord of bigrams.values()) {
      const char0Record = unigrams.get(bigramRecord.str[0]);
      const char1Record = unigrams.get(bigramRecord.str[1]);
      if (char0Record && char1Record) {
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
  }
  function calculateNgramProbabilities(N, ngrams, subNgrams) {
    for (const ngramRecord of ngrams.values()) {
      const charRecords = new Array(N);
      let isValid = true;
      for (let i = 0; i < N; ++i) {
        charRecords[i] = unigrams.get(ngramRecord.str[i]);
        if (!charRecords[i]) {
          isValid = false;
        }
      }
      if (isValid) {
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
      }
      const startCharRecord = unigrams.get(ngramRecord.str[0]);
      const suffixRecord = subNgrams.get(ngramRecord.str.slice(1));
      const prefixRecord = subNgrams.get(ngramRecord.str.slice(0, N - 1));
      const endCharRecord = unigrams.get(ngramRecord.str[N - 1]);
      if (!startCharRecord || !suffixRecord) {
        ngramRecord.Z1 = Number.NaN;
      } else {
        const startCharEstimateSquared = startCharRecord.estimate * startCharRecord.estimate;
        const suffixEstimateSquared = suffixRecord.estimate * suffixRecord.estimate;
        const ngramIndependentEstimate1 = startCharRecord.estimate * suffixRecord.estimate;
        const ngramIndependentVariance1 = (startCharRecord.variance + startCharEstimateSquared) * (suffixRecord.variance + suffixEstimateSquared) - (startCharEstimateSquared * suffixEstimateSquared);
        const ngramDifferenceEstimate1 = ngramRecord.estimate - ngramIndependentEstimate1;
        const ngramDifferenceVariance1 = ngramRecord.variance + ngramIndependentVariance1;
        const ngramDifferenceStdev1 = Math.sqrt(ngramDifferenceVariance1);
        ngramRecord.Z1 = ngramDifferenceEstimate1 / ngramDifferenceStdev1;
      }
      if (!prefixRecord || !endCharRecord) {
        ngramRecord.Z2 = Number.NaN;
      } else {
        const prefixEstimateSquared = prefixRecord.estimate * prefixRecord.estimate;
        const endCharEstimateSquared = endCharRecord.estimate * endCharRecord.estimate;
        const ngramIndependentEstimate2 = prefixRecord.estimate * endCharRecord.estimate;
        const ngramIndependentVariance2 = (prefixRecord.variance + prefixEstimateSquared) * (endCharRecord.variance + endCharEstimateSquared) - (prefixEstimateSquared * endCharEstimateSquared);
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
      if (!Number.isNaN(ngramRecord.Z1) && !Number.isNaN(ngramRecord.Z2) && ((ngramRecord.Z1 > thresholdZ) || (ngramRecord.Z2 > thresholdZ))) {
        vettedNgrams.set(ngramRecord.str, {
          str: ngramRecord.str,
          instances: ngramRecord.instances,
        });
      }
    }
    return vettedNgrams;
  }
  function decimateNgrams(N, vettedNgrams, vettedSuperNgrams) {
    const decimatedNgrams = new Map();
    for (const ngramRecord of vettedNgrams.values()) {
      decimatedNgrams.set(ngramRecord.str, {
        str: ngramRecord.str,
        instances: new Set(ngramRecord.instances),
      });
    }
    for (const ngramRecord of vettedSuperNgrams.values()) {
      const prefix = ngramRecord.str.slice(0, N);
      const prefixRecord = decimatedNgrams.get(prefix);
      if (prefixRecord) {
        for (const instance of ngramRecord.instances) {
          prefixRecord.instances.delete(instance);
        }
      }
      const suffix = ngramRecord.str.slice(1);
      const suffixRecord = decimatedNgrams.get(suffix);
      if (suffixRecord) {
        for (const instance of ngramRecord.instances) {
          suffixRecord.instances.delete(instance + 1);
        }
      }
    }
    calculateNgramEstimates(N, decimatedNgrams);
    return decimatedNgrams;
  }
}
