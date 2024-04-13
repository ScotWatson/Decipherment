/*
(c) 2024 Scot Watson  All Rights Reserved
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

"use strict";

const initPageTime = performance.now();

const loadInterface = loadWindow.then(function () {
  return import("https://scotwatson.github.io/WebInterface/20240316/interface.mjs");
});

Promise.all( [ loadInterface ] ).then(start, fail);

function fail() {
  console.log("Fail");
}

function start([ Interface ]) {
  try {
    const BODY = Interface.createBodyObject({});
    const mainLayout = BODY.createAttached({
      objectId: Interface.OBJECT_LAYOUT,
      parameters: {
        layoutId: Interface.LAYOUT_HEADER,
      },
    });
    mainLayout.createAttached({
      area: "header",
      objectId: Interface.OBJECT_TEXT,
      parameters: {
        text: "Decipherment",
      },
    });
    mainLayout.createAttached({
      area: "body",
      objectId: Interface.OBJECT_TEXT,
      parameters: {
        text: "Select File",
      },
    }).addClickListener({
      handler: readFile,
    });
    async function readFile() {
      const file = await Interface.modalSingleFile({});
      if (file !== null) {
        interpretFile(file);
      }
    }
    const threshold = 2;
    const zThreshold = 3;
    async function interpretFile(file) {
      const text = await file.text();
      const display = mainLayout.createAttached({
        area: "body",
        objectId: Interface.OBJECT_HTML,
        parameters: {
        },
      });
      const mapUnigram = countNgrams(text, 1);
      const arrUnigramResults = getUnigramResults(mapUnigram, text.length);
      arrUnigramResults.sort(function (a, b) {
        return (a.ratio < b.ratio) ? 1 : -1;
      });
      addUnigramTable(display, arrUnigramResults);
      const mapDigram = countNgrams(text, 2);
      const mapTrigram = countNgrams(text, 3);
      const arrDigramResults = getNgramResults(2, mapDigram, mapUnigram, mapUnigram);
      console.log(arrDigramResults);
      const arrUnigramPrefixes = getUnigramPrefixes(arrDigramResults);
      addUnigramPrefixTable(arrUnigramPrefixes, display);
      const arrUnigramSuffixes = getUnigramSuffixes(arrDigramResults);
      addUnigramSuffixTable(arrUnigramSuffixes, display);
      arrDigramResults.sort(function (a, b) {
        return (a.z < b.z) ? 1 : -1;
      });
      addDigramTable(display, arrDigramResults);
      const arrTrigramResults = getNgramResults(3, mapTrigram, mapDigram, mapUnigram);
      arrTrigramResults.sort(function (a, b) {
        return (a.z < b.z) ? 1 : -1;
      });
      console.log(arrTrigramResults);
      addTrigramTable(display, arrTrigramResults);
      const arrMapGrams = [null, mapUnigram, mapDigram, mapTrigram];
      const arrResultArrays = [null, arrUnigramResults, arrDigramResults, arrTrigramResults];
      for (let i = 4; i < 100; ++i) {
        arrMapGrams[i] = countNgrams(text, i);
        arrResultArrays[i] = getNgramResults(i, arrMapGrams[i], arrMapGrams[i - 1], mapUnigram);
        arrResultArrays[i].sort(function (a, b) {
          return (a.z < b.z) ? 1 : -1;
        });
        console.log(arrResultArrays[i]);
        addNgramTable(i, display, arrResultArrays[i]);
      }
      console.log("done");
    }
    function countGram(gram, excludePrefixes, excludeSuffixes) {
      let index = 0;
      function check() {
        for (const prefix of excludePrefixes) {
          if (text.at(index - 1) === prefix) {
            return false;
          }
        }
        for (const suffix of excludeSuffixes) {
          if (text.at(index + gram.length) === suffix) {
            return false;
          }
        }
        return true;
      }
      index = text.indexOf(gram);
      let count = 0;
      while (index !== -1) {
        if (check()) {
          ++count;
        }
        index = text.indexOf(gram, index + 1);
      }
      return count;
    }
    function strPresent(str) {
      let ret = "";
      for (const char of str) {
        if (char.charCodeAt(0) <= 0x20) {
          ret += String.fromCharCode(0xFFFD);
        } else {
          ret += char;
        }
      }
      ret += " (";
      for (const char of str) {
        ret += " " + char.charCodeAt(0).toString(16).padStart(2, "0");
      }
      ret += " )";
      return ret;
    }
    function countUnigrams(text) {
      const mapUnigram = new Map();
      for (const char of text) {
        let obj = mapUnigram.get(char);
        if (!obj) {
          obj = {
            str: char,
            count: 0,
          };
          mapUnigram.set(char, obj);
        }
        ++obj.count;
      }
      for (const obj of mapUnigram.values()) {
        obj.ratio = obj.count / numSamples;
        obj.normDist = binomialAsNormDist({
          numOccurances: obj.count,
          numSamples: text.length,
        });
      }
      return mapUnigram;
    }
    function countNgrams(text, n) {
      const mapNgram = new Map();
      if (text.length < n) {
        return mapNgram;
      }
      let buffer = text.substring(0, n);
      parse();
      let i = n;
      while (i < text.length) {
        const char = text[i];
        buffer = buffer.substring(1) + char;
        parse();
        ++i;
      }
      return mapNgram;
      function parse() {
        let obj = mapNgram.get(buffer);
        if (!obj) {
          obj = {
            str: buffer,
            count: 0,
          };
          mapNgram.set(obj.str, obj);
        }
        ++obj.count;
      }
    }
    function getUnigramResults(mapUnigram, textLength) {
      const arrUnigramResults = [];
      for (const entry of mapUnigram.entries()) {
        const objCount = entry[1];
        if (objCount.count < threshold) {
          continue;
        }
        let objResult = {
          str: objCount.str,
        };
        const char1 = objCount.str[0];
        objResult.ratio = objCount.count / textLength;
        arrUnigramResults.push(objResult);
      }
      return arrUnigramResults;
    }
    function binomialAsNormDist({
      numOccurances,
      numSamples,
    }) {
      const mean = (numOccurances + 1) / (numSamples + 2);
      return {
        mean: mean,
        variance: ((numOccurances + 1) * (numOccurances + 2)) / ((numSamples + 2) * (numSamples + 3)) - (mean * mean),
      };
    }
    function normDistProduct({
      normDist1,
      normDist2,
    }) {
      const normDist1MeanSquared = normDist1.mean * normDist1.mean;
      const normDist2MeanSquared = normDist2.mean * normDist2.mean;
      return {
        mean: normDist1.mean * normDist2.mean,
        variance: ((normDist1.variance + normDist1MeanSquared) * (objSuffix.variance + normDist2MeanSquared)) - (normDist1MeanSquared * normDist2MeanSquared),
      };
    }
    function normDistDifference({
      normDist1,
      normDist2,
    }) {
      return {
        mean: normDist1.mean - normDist2.mean,
        variance: normDist1.variance + normDist2.variance,
      };
    }
    function getNgramResults(n, mapFullGram, mapPrefixGram, mapUnigram) {
      for (const objFull of mapFullGram.values()) {
        const objPrefix = mapPrefixGram.get(objFull.str.substring(0, n - 1));
        const objSuffix = mapUnigram.get(objFull.str[n - 1]);
        if (!objPrefix) {
          console.error("Unable to find:" + objFull.str.substring(0, n - 1));
          continue;
        }
        if (!objSuffix) {
          console.error("Unable to find:" + objFull.str[n - 1]);
          continue;
        }
        if ((objPrefix.count < threshold) || (objSuffix.count < threshold) || (objFull.count < threshold)) {
          objFull.z = 0;
          continue;
        }
        const distSuffixGivenPrefix = binomialAsNormDist({
          numOccurances: objDigram.count,
          numSamples: objPrefix.count,
        });
        const distSuffix = objSuffix.normDist;
        const distDifference = normDistDifference({
          normDist1: distSuffixGivenPrefix,
          normDist2: distSuffix,
        });
        objFull.z = distDifference.mean / Math.sqrt(distDifference.variance);
      }
      const arrResults = [];
      for (const objFull of mapFullGram.values()) {
        if (objFull.z > zThreshold) {
          arrResults.push(objFull);
        }
      }
      return arrResults;
    }
    function getUnigramPrefixes(arrDigramResults) {
      const mapUnigramPrefix = new Map();
      for (const objDigram of arrDigramResults) {
        let obj = mapUnigramPrefix.get(objDigram.str[1]);
        if (!obj) {
          obj = {
            str: objDigram.str[1],
            prefixes: [],
          };
          mapUnigramPrefix.set(objDigram.str[1], obj);
        }
        obj.prefixes.push(objDigram.str[0]);
      }
      return Array.from(mapUnigramPrefix.values());
    }
    function getUnigramSuffixes(arrDigramResults) {
      const mapUnigramSuffix = new Map();
      for (const objDigram of arrDigramResults) {
        let obj = mapUnigramSuffix.get(objDigram.str[0]);
        if (!obj) {
          obj = {
            str: objDigram.str[0],
            suffixes: [],
          };
          mapUnigramSuffix.set(objDigram.str[0], obj);
        }
        obj.suffixes.push(objDigram.str[1]);
      }
      return Array.from(mapUnigramSuffix.values());
    }
    function addUnigramTable(display, arrUnigramResults) {
      const tableUnigrams = document.createElement("table");
      const trUnigramHeader = document.createElement("tr");
      const thUnigram = document.createElement("th");
      thUnigram.append("Unigram");
      trUnigramHeader.appendChild(thUnigram);
      const thUnigramRatio = document.createElement("th");
      thUnigramRatio.append("Ratio");
      trUnigramHeader.appendChild(thUnigramRatio);
      tableUnigrams.appendChild(trUnigramHeader);
      for (const item of arrUnigramResults) {
        const tr = document.createElement("tr");
        const tdUnigram = document.createElement("td");
        tdUnigram.append(strPresent(item.str));
        tr.appendChild(tdUnigram);
        const tdRatio = document.createElement("td");
        tdRatio.append(Math.round(item.ratio * 10000) / 100);
        tdRatio.append("%");
        tr.appendChild(tdRatio);
        tableUnigrams.appendChild(tr);
      }
      display.appendChild(tableUnigrams);
    }
    function addDigramTable(display, arrDigramResults) {
      const tableDigrams = document.createElement("table");
      const trDigramHeader = document.createElement("tr");
      const thDigram = document.createElement("th");
      thDigram.append("Digram");
      trDigramHeader.appendChild(thDigram);
      const thDigramChar1Ratio = document.createElement("th");
      thDigramChar1Ratio.append("Mean");
      trDigramHeader.appendChild(thDigramChar1Ratio);
      const thDigramChar2Ratio = document.createElement("th");
      thDigramChar2Ratio.append("Std Dev");
      trDigramHeader.appendChild(thDigramChar2Ratio);
      const thDigramRatio = document.createElement("th");
      thDigramRatio.append("z");
      trDigramHeader.appendChild(thDigramRatio);
      tableDigrams.appendChild(trDigramHeader);
      for (const item of arrDigramResults) {
        const tr = document.createElement("tr");
        const tdDigram = document.createElement("td");
        tdDigram.append(strPresent(item.str));
        tr.appendChild(tdDigram);
        const tdChar1Ratio = document.createElement("td");
        tdChar1Ratio.append(Math.round(item.mean * 1000000) / 10000);
        tdChar1Ratio.append("%");
        tr.appendChild(tdChar1Ratio);
        const tdChar2Ratio = document.createElement("td");
        tdChar2Ratio.append(Math.round(Math.sqrt(item.variance) * 1000000) / 10000);
        tdChar2Ratio.append("%");
        tr.appendChild(tdChar2Ratio);
        const tdDigramRatio = document.createElement("td");
        tdDigramRatio.append(Math.round(item.z * 100) / 100);
        tr.appendChild(tdDigramRatio);
        tableDigrams.appendChild(tr);
      }
      display.appendChild(tableDigrams);
    }
    function addTrigramTable(display, arrTrigramResults) {
      const tableTrigrams = document.createElement("table");
      const trTrigramHeader = document.createElement("tr");
      const thTrigram = document.createElement("th");
      thTrigram.append("Trigram");
      trTrigramHeader.appendChild(thTrigram);
      const thTrigramDigramRatio = document.createElement("th");
      thTrigramDigramRatio.append("mean");
      trTrigramHeader.appendChild(thTrigramDigramRatio);
      const thTrigramChar3Ratio = document.createElement("th");
      thTrigramChar3Ratio.append("Std Dev");
      trTrigramHeader.appendChild(thTrigramChar3Ratio);
      const thTrigramRatio = document.createElement("th");
      thTrigramRatio.append("z");
      trTrigramHeader.appendChild(thTrigramRatio);
      tableTrigrams.appendChild(trTrigramHeader);
      for (const item of arrTrigramResults) {
        const tr = document.createElement("tr");
        const tdTrigram = document.createElement("td");
        tdTrigram.append(strPresent(item.str));
        tr.appendChild(tdTrigram);
        const tdDigramRatio = document.createElement("td");
        tdDigramRatio.append(Math.round(item.mean * 1000000) / 10000);
        tdDigramRatio.append("%");
        tr.appendChild(tdDigramRatio);
        const tdChar3Ratio = document.createElement("td");
        tdChar3Ratio.append(Math.round(Math.sqrt(item.variance) * 1000000) / 10000);
        tdChar3Ratio.append("%");
        tr.appendChild(tdChar3Ratio);
        const tdTrigramRatio = document.createElement("td");
        tdTrigramRatio.append(Math.round(item.z * 100) / 100);
        tr.appendChild(tdTrigramRatio);
        tableTrigrams.appendChild(tr);
      }
      display.appendChild(tableTrigrams);
    }
    function addNgramTable(n, display, arrTrigramResults) {
      const tableTrigrams = document.createElement("table");
      const trTrigramHeader = document.createElement("tr");
      const thTrigram = document.createElement("th");
      thTrigram.append(n + "gram");
      trTrigramHeader.appendChild(thTrigram);
      const thTrigramDigramRatio = document.createElement("th");
      thTrigramDigramRatio.append("mean");
      trTrigramHeader.appendChild(thTrigramDigramRatio);
      const thTrigramChar3Ratio = document.createElement("th");
      thTrigramChar3Ratio.append("Std Dev");
      trTrigramHeader.appendChild(thTrigramChar3Ratio);
      const thTrigramRatio = document.createElement("th");
      thTrigramRatio.append("z");
      trTrigramHeader.appendChild(thTrigramRatio);
      tableTrigrams.appendChild(trTrigramHeader);
      for (const item of arrTrigramResults) {
        const tr = document.createElement("tr");
        const tdTrigram = document.createElement("td");
        tdTrigram.append(strPresent(item.str));
        tr.appendChild(tdTrigram);
        const tdDigramRatio = document.createElement("td");
        tdDigramRatio.append(Math.round(item.mean * 1000000) / 10000);
        tdDigramRatio.append("%");
        tr.appendChild(tdDigramRatio);
        const tdChar3Ratio = document.createElement("td");
        tdChar3Ratio.append(Math.round(Math.sqrt(item.variance) * 1000000) / 10000);
        tdChar3Ratio.append("%");
        tr.appendChild(tdChar3Ratio);
        const tdTrigramRatio = document.createElement("td");
        tdTrigramRatio.append(Math.round(item.z * 100) / 100);
        tr.appendChild(tdTrigramRatio);
        tableTrigrams.appendChild(tr);
      }
      display.appendChild(tableTrigrams);
    }
    function addUnigramPrefixTable(arr, display) {
      arr.sort(function (a,b) {
        return (a.str.charCodeAt(0) < b.str.charCodeAt(0)) ? 1 : -1; 
      });
      const table = document.createElement("table");
      const trHeader = document.createElement("tr");
      const thUnigram = document.createElement("th");
      thUnigram.append("Unigram");
      thUnigram.style = "width:200px;";
      trHeader.appendChild(thUnigram);
      const thPrefixes = document.createElement("th");
      thPrefixes.append("Prefixes");
      trHeader.appendChild(thPrefixes);
      table.appendChild(trHeader);
      for (const item of arr) {
        const tr = document.createElement("tr");
        const tdUnigram = document.createElement("td");
        tdUnigram.append(strPresent(item.str));
        tr.appendChild(tdUnigram);
        const tdPrefixes = document.createElement("td");
        item.prefixes.sort();
        for (const prefix of item.prefixes) {
          tdPrefixes.append(strPresent(prefix) + " ");
        }
        tr.appendChild(tdPrefixes);
        table.appendChild(tr);
      }
      display.appendChild(table);
    }
    function addUnigramSuffixTable(arr, display) {
      const table = document.createElement("table");
      const trHeader = document.createElement("tr");
      const thUnigram = document.createElement("th");
      thUnigram.append("Unigram");
      thUnigram.style = "width:200px;";
      trHeader.appendChild(thUnigram);
      const thSuffixes = document.createElement("th");
      thSuffixes.append("Suffixes");
      trHeader.appendChild(thSuffixes);
      table.appendChild(trHeader);
      for (const item of arr) {
        const tr = document.createElement("tr");
        const tdUnigram = document.createElement("td");
        tdUnigram.append(strPresent(item.str));
        tr.appendChild(tdUnigram);
        const tdSuffixes = document.createElement("td");
        item.suffixes.sort();
        for (const suffix of item.suffixes) {
          tdSuffixes.append(strPresent(suffix) + " ");
        }
        tr.appendChild(tdSuffixes);
        table.appendChild(tr);
      }
      display.appendChild(table);
    }
  } catch (e) {
    console.error(e);
  }
}
