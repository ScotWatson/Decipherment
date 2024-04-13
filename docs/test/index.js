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
    const threshold = 3;
    const zThreshold = 3;
    async function interpretFile(file) {
      const text = await file.text();
      const appLayout = mainLayout.createAttached({
        area: "body",
        objectId: Interface.OBJECT_LAYOUT,
        parameters: {
          layoutId: Interface.LAYOUT_HEADER,
        },
      });
      const mainDisplay = appLayout.createAttached({
        area: "body",
        objectId: Interface.OBJECT_TILES,
        parameters: {
        },
      });
      appLayout.createAttached({
        area: "header",
        objectId: Interface.OBJECT_TEXT,
        parameters: {
          text: "Home",
        },
      }).addClickListener({
        handler: function () {
          mainDisplay.attach();
        },
      });
      const displayUnigram = appLayout.createDetached({
        area: "body",
        objectId: Interface.OBJECT_HTML,
        parameters: {
        },
      });
      mainDisplay.addItem({
        imgSrc: "",
        itemName: "Unigram",
      }).addClickListener({
        handler: function () {
          displayUnigram.attach();
        },
      });
      const mapUnigram = countUnigrams(text);
      const arrUnigramResults = getUnigramResults(mapUnigram, text.length);
      arrUnigramResults.sort(function (a, b) {
        return (a.ratio < b.ratio) ? 1 : -1;
      });
      addUnigramTable(displayUnigram, arrUnigramResults);
      /*
      const arrUnigramPrefixes = getUnigramPrefixes(arrDigramResults);
      addUnigramPrefixTable(arrUnigramPrefixes, display);
      const arrUnigramSuffixes = getUnigramSuffixes(arrDigramResults);
      addUnigramSuffixTable(arrUnigramSuffixes, display);
      */
      const mapDigram = countNgrams(text, 2);     
      const arrMapGrams = [null, mapUnigram, mapDigram];
      const arrResultArrays = [null, arrUnigramResults];
      let i = 3;
      console.log("Counting N-grams");
      while (arrMapGrams[i - 1].size !== 0) {
        console.log(i);
        arrMapGrams[i] = countNgrams(text, i);
        removeSubsequence(arrMapGrams[i], arrMapGrams[i - 1]);
        ++i;
      }
      for (let i = 2; i < arrMapGrams.length; ++i) {
        arrResultArrays[i] = getNgramResults(i, arrMapGrams[i], arrMapGrams[i - 1], mapUnigram);
        arrResultArrays[i].sort(function (a, b) {
          return (a.z < b.z) ? 1 : -1;
        });
        console.log(arrResultArrays[i]);
      }
      for (let i = 2; i < arrMapGrams.length; ++i) {
        const displayNgram = appLayout.createDetached({
          area: "body",
          objectId: Interface.OBJECT_HTML,
          parameters: {
          },
        });
        mainDisplay.addItem({
          imgSrc: "",
          itemName: i + "-gram",
        }).addClickListener({
          handler: function () {
            displayNgram.attach();
          },
        });
        const nGramTable = createNgramTable(i, arrResultArrays[i]);
        displayNgram.appendChild(nGramTable);
      }
      console.log("done");
    }
    function removeSubsequence(mapUpper, mapLower) {
      for (const item of mapUpper.values()) {
        const n = item.str.length;
        const prefix = item.str.substring(0, n - 1);
        const suffix = item.str.substring(1, n);
        const objPrefix = mapLower.get(prefix);
        if (objPrefix) {
          if (objPrefix.count === item.count) {
            mapLower.delete(prefix);
          }
        }
        const objSuffix = mapLower.get(suffix);
        if (objSuffix) {
          if (objSuffix.count === item.count) {
            mapLower.delete(suffix);
          }
        }
      }
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
        obj.ratio = obj.count / text.length;
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
      for (const obj of mapNgram.values()) {
        if (obj.count < threshold) {
          mapNgram.delete(obj.str);
        }
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
      return Array.from(mapUnigram.values());
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
        const fullCount = objFull.count;
        const prefixCount = (function () {
          if (!objPrefix) {
            return fullCount;
          } else {
            return objPrefix.count;
          }
        })();
        if (!objSuffix) {
          console.error("Missing Unigram" + objFull.str[n - 1]);
          continue;
        }
        const distSuffixGivenPrefix = binomialAsNormDist({
          numOccurances: fullCount,
          numSamples: prefixCount,
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
      const thUnigramRatioMean = document.createElement("th");
      thUnigramRatioMean.append("Mean");
      trUnigramHeader.appendChild(thUnigramRatioMean);
      const thUnigramRatioStdev = document.createElement("th");
      thUnigramRatioStdev.append("Std Dev");
      trUnigramHeader.appendChild(thUnigramRatioStdev);
      const thUnigramRatio = document.createElement("th");
      thUnigramRatio.append("Ratio");
      trUnigramHeader.appendChild(thUnigramRatio);
      tableUnigrams.appendChild(trUnigramHeader);
      for (const item of arrUnigramResults) {
        console.log(item);
        const tr = document.createElement("tr");
        const tdUnigram = document.createElement("td");
        tdUnigram.append(strPresent(item.str));
        tr.appendChild(tdUnigram);
        const tdRatioMean = document.createElement("td");
        tdRatioMean.append(Math.round(item.normDist.mean * 1000000) / 10000);
        tdRatioMean.append("%");
        tr.appendChild(tdRatioMean);
        const tdRatioStdev = document.createElement("td");
        tdRatioStdev.append(Math.round(Math.sqrt(item.normDist.variance) * 1000000) / 10000);
        tdRatioStdev.append("%");
        tr.appendChild(tdRatioStdev);
        const tdUnigramRatio = document.createElement("td");
        tdUnigramRatio.append(Math.round(item.ratio * 1000000) / 10000);
        tdUnigramRatio.append("%");
        tr.appendChild(tdUnigramRatio);
        tableUnigrams.appendChild(tr);
      }
      display.appendChild(tableUnigrams);
    }
    function createNgramTable(n, arrNgramResults) {
      const tableNgrams = document.createElement("table");
      const trNgramHeader = document.createElement("tr");
      const thNgram = document.createElement("th");
      thNgram.append(n + "-gram");
      trNgramHeader.appendChild(thNgram);
      const thNgramCount = document.createElement("th");
      thNgramCount.append("Count");
      trNgramHeader.appendChild(thNgramCount);
      const thNgramZ = document.createElement("th");
      thNgramZ.append("z");
      trNgramHeader.appendChild(thNgramZ);
      tableNgrams.appendChild(trNgramHeader);
      for (const item of arrNgramResults) {
        const tr = document.createElement("tr");
        const tdNgram = document.createElement("td");
        tdNgram.append(strPresent(item.str));
        tr.appendChild(tdNgram);
        const tdNgramCount = document.createElement("td");
        tdNgramCount.append(item.count);
        tr.appendChild(tdNgramCount);
        const tdNgramZ = document.createElement("td");
        tdNgramZ.append(Math.round(item.z * 100) / 100);
        tr.appendChild(tdNgramZ);
        tableNgrams.appendChild(tr);
      }
      return tableNgrams;
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
