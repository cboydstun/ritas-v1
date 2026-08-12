"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar, Pie } from "react-chartjs-2";

/**
 * chart.js and its React bindings, isolated behind one module so the analytics
 * page can `next/dynamic` them. Imported statically they were ~70 kB of the
 * admin page's own bundle and pulled into the shared admin chunk.
 */
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
);

export { Line, Bar, Pie };
