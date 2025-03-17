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
  const maxN = 10;
  const ngrams = new Array(maxN);
  const vettedNgrams = new Array(maxN);
  const decimatedNgrams = new Array(maxN);
  const vettedDecimatedNgrams = new Array(maxN);
  const file = await openFileDialog();
  const contents = await file.text();
  const unigrams = getUnigramEstimates(contents);
  ngrams[2] = getNgramEstimates(2);
  vettedNgrams[2] = vetBigramPossibilities(ngrams[2], unigrams);
  ngrams[3] = getNgramEstimates(3);
  vettedNgrams[3] = vetNgramPossibilities(3, ngrams[3], ngrams[2], unigrams);
  decimatedNgrams[2] = decimateNgrams(2, vettedNgrams[2], vettedNgrams[3]);
  vettedDecimatedNgrams[2] = vetBigramPossibilities(decimatedNgrams[2], unigrams);
  for (let i = 4; i < maxN; ++i) {
    ngrams[i] = getNgramEstimates(i);
    vettedNgrams[i] = vetNgramPossibilities(i, ngrams[i], ngrams[i - 1]);
    decimatedNgrams[i - 1] = decimateNgrams(i - 1, vettedNgrams[i - 1], vettedNgrams[i]);
    vettedDecimatedNgrams[i - 1] = vetNgramPossibilities(i - 1, decimatedNgrams[i - 1], ngrams[i - 2], unigrams);
  }
  calculateNgramEstimates(maxN - 1, vettedNgrams[maxN - 1]);
  console.log(Array.from(unigrams.values()).sort((entry1, entry2) => { return (entry1.count < entry2.count) ? 1 : -1; }));
  for (let i = 2; i < maxN - 1; ++i) {
    console.log(Array.from(vettedDecimatedNgrams[i].values()).sort((entry1, entry2) => { return (entry1.Z < entry2.Z) ? 1 : -1; }));
  }
  console.log(Array.from(vettedNgrams[maxN - 1].values()).sort((entry1, entry2) => { return (entry1.Z < entry2.Z) ? 1 : -1; }));

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
  function calculateNgramProbabilities(N, ngrams, subNgrams, unigrams) {
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
        vettedNgrams.set(ngramRecord.str, ngramRecord);
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
