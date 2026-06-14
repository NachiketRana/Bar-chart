import express from 'express';
import { getData, createData } from '../controllers/data.controller.js';

const router = express.Router();

router.get('/', getData);           // GET /  (all stocks, day-wise)
router.get('/data', getData);       // GET /data  OR  /data?symbol=AAPL
router.get('/data/:symbol', (req, res) => {
  req.query.symbol = req.params.symbol; // forward param as query
  return getData(req, res);
});                                 // GET /data/AAPL
router.get('/:symbol', (req, res) => {
  req.query.symbol = req.params.symbol; // forward param as query
  return getData(req, res);
});                                 // GET /AAPL
router.post('/data', createData);

export default router;
