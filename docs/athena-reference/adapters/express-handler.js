import { analyseFixture } from '../src/index.js';

export function createAthenaHandler(config = {}) {
  return function athenaHandler(req, res) {
    try {
      const result = analyseFixture(req.body, config);
      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({
        error: 'ATHENA_INPUT_ERROR',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  };
}
